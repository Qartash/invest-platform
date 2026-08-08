import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class FundPlatformDto {
  @IsNumber()
  @Min(1)
  amount: number;

  // What the money is, in the admin's own words — a bank transfer reference, a
  // budget line. Optional, but it is the only thing separating a funded pool
  // from a number somebody typed.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
