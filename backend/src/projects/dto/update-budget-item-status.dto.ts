import { IsEnum } from 'class-validator';
import { BudgetItemStatus } from '../../common/enums';

export class UpdateBudgetItemStatusDto {
  @IsEnum(BudgetItemStatus)
  status: BudgetItemStatus;
}
