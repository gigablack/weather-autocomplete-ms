import { Test, TestingModule } from '@nestjs/testing';
import { AutocompleteService } from './autocomplete.service';
import { getModelToken } from '@nestjs/mongoose';
import { City } from '../schemas/city.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AutocompleteResponseDto } from './dto/autocomplete-response.dto';
import { ExternalCityDto } from './dto/external-city.dto';
import { plainToInstance } from 'class-transformer';
import { ConfigService } from '@nestjs/config';

// Mocks
class CityModelMock {
  static find = jest.fn().mockReturnThis();
  static exec = jest.fn();
  static insertMany = jest.fn();
  static create = jest.fn().mockImplementation((dto) => dto);
}

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockHttpService = {
  get: jest.fn(),
};

describe('AutocompleteService', () => {
  let service: AutocompleteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutocompleteService,
        {
          provide: getModelToken(City.name),
          useValue: CityModelMock,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'redis.ttl':
                  return 3600000;
                case 'weatherApi.key':
                  return 'test-key';
                case 'weatherApi.baseUrl':
                  return 'https://api.weatherapi.com/v1';
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AutocompleteService>(AutocompleteService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAutocompleteSuggestions', () => {
    const mockCachedData = ['London, United Kingdom', 'London, Canada'];
    const mockDBCities = [
      { name: 'London', country: 'United Kingdom' },
      { name: 'London', country: 'Canada' },
    ];
    const mockApiResponse = [
      { name: 'New York', country: 'United States' },
      { name: 'Newark', country: 'United States' },
    ];

    it('should return cached data in correct format', async () => {
      mockCacheManager.get.mockResolvedValue(mockCachedData);

      const result = await service.getAutocompleteSuggestions('Lon');

      expect(result).toBeInstanceOf(AutocompleteResponseDto);
      expect(result.suggestions).toEqual(mockCachedData);
      expect(result.cached).toBe(true);
      expect(result.source).toBe('cache');
    });

    it('should query database with parsed city and country', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      CityModelMock.exec.mockResolvedValue(mockDBCities);

      const result = await service.getAutocompleteSuggestions('London, Uni');

      expect(CityModelMock.find).toHaveBeenCalledWith({
        name: expect.any(RegExp),
        country: expect.any(RegExp),
      });
      expect(result.suggestions).toEqual([
        'London, United Kingdom',
        'London, Canada',
      ]);
      expect(result.source).toBe('database');
    });

    it('should call external API and save results', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      CityModelMock.exec.mockResolvedValue([]);
      mockHttpService.get.mockReturnValue(of({ data: mockApiResponse }));

      const result = await service.getAutocompleteSuggestions('New');

      expect(mockHttpService.get).toHaveBeenCalled();
      expect(CityModelMock.insertMany).toHaveBeenCalledWith(
        [
          { name: 'New York', country: 'United States' },
          { name: 'Newark', country: 'United States' },
        ],
        { ordered: false },
      );
      expect(result.suggestions).toEqual([
        'New York, United States',
        'Newark, United States',
      ]);
      expect(result.source).toBe('api');
    });

    it('should handle empty query', async () => {
      const result = await service.getAutocompleteSuggestions('');
      expect(result.suggestions).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      CityModelMock.exec.mockResolvedValue([]);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      await expect(
        service.getAutocompleteSuggestions('Berlin'),
      ).rejects.toThrow('Failed to retrieve suggestions');
    });
  });

  describe('parseQuery', () => {
    it('should split city and country correctly', () => {
      const [city, country] = (service as any).parseQuery('Paris, France');
      expect(city).toBe('Paris');
      expect(country).toBe('France');
    });

    it('should handle multi-word country names', () => {
      const [city, country] = (service as any).parseQuery(
        'New York, United States',
      );
      expect(city).toBe('New York');
      expect(country).toBe('United States');
    });

    it('should return undefined for country if not present', () => {
      const [city, country] = (service as any).parseQuery('Madrid');
      expect(city).toBe('Madrid');
      expect(country).toBeUndefined();
    });
  });

  describe('queryDatabase', () => {
    it('should search by city name only', async () => {
      CityModelMock.exec.mockResolvedValue([
        { name: 'Paris', country: 'France' },
      ]);

      const result = await (service as any).queryDatabase('Paris');

      expect(CityModelMock.find).toHaveBeenCalledWith(
        {
          name: expect.any(RegExp),
        },
        {},
        { limit: 10 },
      );
      expect(result).toEqual([{ name: 'Paris', country: 'France' }]);
    });

    it('should search by city and country', async () => {
      CityModelMock.exec.mockResolvedValue([
        { name: 'London', country: 'United Kingdom' },
      ]);

      const result = await (service as any).queryDatabase('Lon', 'Unit');

      expect(CityModelMock.find).toHaveBeenCalledWith(
        {
          name: expect.any(RegExp),
          country: expect.any(RegExp),
        },
        {},
        { limit: 10 },
      );
      expect(result).toEqual([{ name: 'London', country: 'United Kingdom' }]);
    });

    it('should handle special characters in search query', async () => {
      CityModelMock.exec.mockResolvedValue([
        { name: 'São Paulo', country: 'Brazil' },
      ]);

      const result = await (service as any).queryDatabase('são pa', 'Bra');

      expect(CityModelMock.find).toHaveBeenCalledWith(
        {
          name: expect.any(RegExp),
          country: expect.any(RegExp),
        },
        {},
        { limit: 10 },
      );
      expect(result).toEqual([{ name: 'São Paulo', country: 'Brazil' }]);
    });

    it('should return empty array if no results', async () => {
      CityModelMock.exec.mockResolvedValue([]);

      const result = await (service as any).queryDatabase('Unknown', 'Country');
      expect(result).toEqual([]);
    });

    it('should apply search limit', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      CityModelMock.find.mockReturnValue({
        exec: mockExec,
      });

      await (service as any).queryDatabase('New');

      expect(CityModelMock.find).toHaveBeenCalledWith(
        { name: expect.any(RegExp) },
        {},
        { limit: 10 },
      );
    });
  });

  describe('saveToDatabase', () => {
    it('should prevent duplicate entries', async () => {
      const existingCities = [{ name: 'London', country: 'United Kingdom' }];
      const newCities = [
        { name: 'London', country: 'United Kingdom' },
        { name: 'London', country: 'Canada' },
      ];

      jest.spyOn(CityModelMock, 'find').mockResolvedValue(existingCities);
      const insertSpy = jest.spyOn(CityModelMock, 'insertMany');

      await (service as any).saveToDatabase(
        plainToInstance(ExternalCityDto, newCities),
      );

      expect(insertSpy).toHaveBeenCalledWith(
        [{ name: 'London', country: 'Canada' }],
        { ordered: false },
      );
    });

    it('should normalize whitespace and case', async () => {
      const newCities = [
        { name: '  new york  ', country: '  united states  ' },
      ];

      await (service as any).saveToDatabase(
        plainToInstance(ExternalCityDto, newCities),
      );

      expect(CityModelMock.insertMany).toHaveBeenCalledWith(
        [{ name: 'new york', country: 'united states' }],
        { ordered: false },
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
