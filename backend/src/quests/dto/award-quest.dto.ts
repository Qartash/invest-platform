import { IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class AwardQuestDto {
  @IsUUID()
  userId: string;

  // Omitted pays the quest's headline reward; a smaller figure fits a smaller find.
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;
}
