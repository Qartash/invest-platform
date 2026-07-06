import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class BuyListingDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;
}
