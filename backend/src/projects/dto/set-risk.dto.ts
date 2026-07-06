import { IsIn, IsString, MinLength } from 'class-validator';

export class SetRiskDto {
  @IsIn(['low', 'medium', 'high'])
  riskLevel: string;

  @IsString()
  @MinLength(1)
  reason: string;
}
