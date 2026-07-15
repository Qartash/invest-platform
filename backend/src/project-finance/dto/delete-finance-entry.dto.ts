import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteFinanceEntryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
