import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RequestReleaseDto {
  @IsUUID()
  budgetItemId: string;

  @IsString()
  @IsOptional()
  note?: string;
}
