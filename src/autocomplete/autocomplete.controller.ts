import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AutocompleteService } from './autocomplete.service';
import { CreateAutocompleteDto } from './dto/create-autocomplete.dto';

@Controller()
export class AutocompleteController {
  constructor(private readonly autocompleteService: AutocompleteService) {}

  @MessagePattern('autocomplete.get')
  getAutocompleteSuggestions(
    @Payload() autocompleteDto: CreateAutocompleteDto,
  ) {
    return this.autocompleteService.getAutocompleteSuggestions(
      autocompleteDto.query,
    );
  }
}
