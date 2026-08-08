import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetItemInputDto } from './create-project.dto';

export class AddBudgetItemsDto {
  // `@IsArray()` on its own says nothing about what is *in* the array: without the
  // `@Type` hint class-transformer leaves the elements as plain objects, and
  // class-validator has nothing to walk them with. Every rule on BudgetItemInputDto —
  // the title being a string, the amount being a positive number — was being skipped,
  // and `whitelist: true` was not stripping unknown keys either, because stripping also
  // needs the element type. A budget line of `{ amount: -1e9 }` validated cleanly.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BudgetItemInputDto)
  items: BudgetItemInputDto[];
}
