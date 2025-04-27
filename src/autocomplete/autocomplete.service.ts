import { Inject, Injectable, Logger } from '@nestjs/common';
import { AutocompleteResponseDto } from './dto/autocomplete-response.dto';
import { ExternalCityDto } from './dto/external-city.dto';
import { City } from '../schemas/city.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { envs } from '../config';
import { RpcException } from '@nestjs/microservices';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AutocompleteService {
  private readonly logger = new Logger(AutocompleteService.name);
  constructor(
    @InjectModel(City.name) private readonly cityModel: Model<City>,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  async getAutocompleteSuggestions(
    query: string,
  ): Promise<AutocompleteResponseDto> {
    try {
      const normalizedQuery = query.trim();
      if (!normalizedQuery)
        return new AutocompleteResponseDto({ suggestions: [] });

      const cacheKey = `autocomplete:${normalizedQuery.toLowerCase()}`;

      // Verificar cache
      const cached = await this.cacheManager.get<string[]>(cacheKey);
      if (cached) {
        return new AutocompleteResponseDto({
          suggestions: cached,
          cached: true,
          source: 'cache',
        });
      }

      // Buscar en MongoDB
      const [cityName, country] = this.parseQuery(normalizedQuery);
      const dbResults = await this.queryDatabase(cityName, country);

      if (dbResults.length > 0) {
        const suggestions = dbResults.map((c) => `${c.name}, ${c.country}`);
        await this.cacheManager.set(cacheKey, suggestions, envs.redisTTL);
        return new AutocompleteResponseDto({
          suggestions,
          cached: false,
          source: 'database',
        });
      }

      // Llamar a la API externa
      const apiResults = await this.callExternalApi(normalizedQuery);
      await this.saveToDatabase(apiResults);

      const suggestions = apiResults.map((c) => `${c.name}, ${c.country}`);
      await this.cacheManager.set(cacheKey, suggestions, envs.redisTTL);

      return new AutocompleteResponseDto({
        suggestions,
        cached: false,
        source: 'api',
      });
    } catch (error) {
      this.logger.error('Error on Autocomplete Service', error.stack);
      throw new RpcException('Failed to retrieve suggestions');
    }
  }

  private parseQuery(query: string): [string, string?] {
    const parts = query.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      return [parts[0], parts.slice(1).join(', ')];
    }
    return [query, undefined];
  }

  private async queryDatabase(
    cityName: string,
    country?: string,
  ): Promise<City[]> {
    const query: any = {
      name: new RegExp(cityName, 'i'),
    };
    if (country) {
      query.country = new RegExp(`^${country}`, 'i');
    }
    const result = await this.cityModel.find(query, {}, { limit: 10 }).exec();
    return result;
  }

  private async saveToDatabase(cities: ExternalCityDto[]): Promise<void> {
    const formattedCities = cities.map((c) => ({
      name: c.name.trim(),
      country: c.country.trim(),
      latitude: c.latitude,
      longitude: c.longitude,
    }));

    const existing = await this.cityModel.find({
      $or: formattedCities.map((c) => ({
        name: new RegExp(`^${c.name}$`, 'i'),
        country: new RegExp(`^${c.country}$`, 'i'),
      })),
    });

    const newCities = formattedCities.filter(
      (c) =>
        !existing.some(
          (e) =>
            e.name.toLowerCase() === c.name.toLowerCase() &&
            e.country.toLowerCase() === c.country.toLowerCase(),
        ),
    );

    if (newCities.length > 0) {
      await this.cityModel.insertMany(newCities, { ordered: false });
    }
  }
  private async callExternalApi(query: string): Promise<ExternalCityDto[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${envs.weatherApiBaseUrl}/search.json?key=${envs.weatherApiKey}&q=${query}`,
        ),
      );
      return response.data;
    } catch (err) {
      this.logger.error(`Error calling API: ${err}`);
      throw new RpcException('Error Calling API');
    }
  }
}
