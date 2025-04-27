import { PartialType } from '@nestjs/mapped-types';
import { CreateAutocompleteDto } from './create-autocomplete.dto';

export class UpdateAutocompleteDto extends PartialType(CreateAutocompleteDto) {
  id: number;
}
