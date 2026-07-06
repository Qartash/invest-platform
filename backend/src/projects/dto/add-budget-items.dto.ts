import { IsArray, ArrayMinSize } from 'class-validator';
import { BudgetItemInputDto } from './create-project.dto';

export class AddBudgetItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  items: BudgetItemInputDto[];
}
