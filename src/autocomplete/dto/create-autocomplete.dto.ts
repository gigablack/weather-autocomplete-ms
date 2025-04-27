import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAutocompleteDto {
  @IsNotEmpty({ message: 'Query parameter is required' })
  @IsString({ message: 'Query must be a string' })
  @Transform(({ value }) => value.replace('-', ' '))
  query: string;
}
