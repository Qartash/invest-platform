import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartnerApplicationStatus } from '../../common/enums';

export class ReviewPartnerDto {
  @IsEnum(PartnerApplicationStatus)
  status: PartnerApplicationStatus;

  // Why — shown to the applicant. A rejection without a reason just gets
  // reapplied unchanged.
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
