import { ArrayNotEmpty, IsArray, IsNumber, IsPositive, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MilestoneInputDto {
  @IsString()
  title: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class AddMilestonesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MilestoneInputDto)
  items: MilestoneInputDto[];
}
