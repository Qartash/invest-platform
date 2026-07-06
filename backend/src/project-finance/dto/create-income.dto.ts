import { IsDateString, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateIncomeDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  description: string;

  @IsDateString()
  date: string;
}
