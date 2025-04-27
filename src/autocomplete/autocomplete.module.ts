import { Module } from '@nestjs/common';
import { AutocompleteService } from './autocomplete.service';
import { AutocompleteController } from './autocomplete.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { City, CitySchema } from 'src/schemas/city.schema';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [AutocompleteController],
  providers: [AutocompleteService],
  imports: [
    MongooseModule.forFeature([{ name: City.name, schema: CitySchema }]),
    HttpModule,
  ],
})
export class AutocompleteModule {}
