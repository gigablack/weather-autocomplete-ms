// src/dto/autocomplete-response.dto.ts
import { Expose } from 'class-transformer';

export class AutocompleteResponseDto {
  @Expose()
  suggestions: string[];

  @Expose()
  cached: boolean;

  @Expose()
  source: 'cache' | 'database' | 'api';

  constructor(partial: Partial<AutocompleteResponseDto>) {
    Object.assign(this, partial);
  }
}
