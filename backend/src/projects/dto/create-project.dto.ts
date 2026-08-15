import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetItemInputDto {
  @IsString()
  @MaxLength(300)
  title: string;

  // Bounded above as well as below: the column is decimal(14,2), so a larger figure is not
  // a big budget line, it is a 500 from the driver on the way in.
  @IsNumber()
  @IsPositive()
  @Max(1_000_000_000_000)
  amount: number;
}

export class CreateProjectDto {
  @IsObject()
  title: Record<string, string>;

  @IsObject()
  description: Record<string, string>;

  @IsNumber()
  @IsPositive()
  targetAmount: number;

  /**
   * @deprecated Ignored. The round-1 price is derived server-side from targetAmount,
   * totalTickets and the round settings so that selling out raises exactly the goal.
   * Still accepted so existing clients that send it don't fail validation.
   */
  @IsNumber()
  @IsPositive()
  @IsOptional()
  ticketPrice?: number;

  @IsInt()
  @IsPositive()
  totalTickets: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  priceTierCount?: number;

  @IsNumber()
  @Min(0)
  @Max(200)
  @IsOptional()
  priceTierIncrementPercent?: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  @IsOptional()
  equityOfferedPercent?: number;

  @IsString()
  @IsOptional()
  youtubeUrl?: string;

  @IsBoolean()
  @IsOptional()
  resaleEnabled?: boolean;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  expectedAnnualReturnPercent?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  payoutStartDays?: number;

  // Same as AddBudgetItemsDto: the element type is what makes the rules on
  // BudgetItemInputDto apply at all, and what lets whitelisting strip unknown keys.
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BudgetItemInputDto)
  budgetItems?: BudgetItemInputDto[];
}
