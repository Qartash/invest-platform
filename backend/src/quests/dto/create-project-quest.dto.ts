import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProjectQuestDto {
  @IsUUID()
  projectId: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(600)
  description?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  // The upper bound is enforced in the service, alongside the rule that explains it.
  @IsNumber()
  @IsPositive()
  reward: number;
}
