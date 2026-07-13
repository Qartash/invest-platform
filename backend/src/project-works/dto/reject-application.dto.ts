import { IsOptional, IsString } from 'class-validator';

export class RejectApplicationDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
