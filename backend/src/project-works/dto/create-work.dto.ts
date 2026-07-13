import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min } from 'class-validator';
import { WorkPaymentType } from '../../common/enums';

export class CreateWorkDto {
  @IsString()
  title: string;

  @IsString()
  brief: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsEnum(WorkPaymentType)
  @IsOptional()
  paymentType?: WorkPaymentType;

  @IsBoolean()
  @IsOptional()
  allowCounterOffers?: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  ticketPremiumPercent?: number;

  @IsUUID()
  @IsOptional()
  budgetItemId?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;
}
