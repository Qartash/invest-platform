import { IsDateString, IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';
import { ExpenseCategory } from '../../common/enums';

export class CreateExpenseDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsString()
  description: string;

  @IsDateString()
  date: string;
}
