import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { WorkPaymentType } from '../../common/enums';

export class ApplyWorkDto {
  @IsString()
  @IsOptional()
  coverLetter?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  offeredPrice?: number;

  @IsEnum(WorkPaymentType)
  @IsOptional()
  preferredPayment?: WorkPaymentType;
}
