import { Expose, Transform } from 'class-transformer';
import { IsString, IsNumber } from 'class-validator';

export class ExternalCityDto {
  @Expose()
  @IsString()
  @Transform(({ value }) => value?.trim())
  name: string;

  @Expose({ name: 'country' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  country: string;

  @Expose({ name: 'lat' })
  @IsNumber()
  latitude: number;

  @Expose({ name: 'lon' })
  @IsNumber()
  longitude: number;
}
