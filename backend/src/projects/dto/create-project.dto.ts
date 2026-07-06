import {
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
  Min,
} from 'class-validator';

export class BudgetItemInputDto {
  @IsString()
  title: string;

  @IsNumber()
  @IsPositive()
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

  @IsNumber()
  @IsPositive()
  ticketPrice: number;

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

  @IsArray()
  @IsOptional()
  budgetItems?: BudgetItemInputDto[];
}
