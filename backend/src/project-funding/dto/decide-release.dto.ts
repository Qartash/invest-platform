import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class DecideReleaseDto {
  @IsBoolean()
  approve: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}
