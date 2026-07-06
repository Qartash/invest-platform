import { IsString, MinLength } from 'class-validator';

export class ReviewProjectDto {
  @IsString()
  @MinLength(1)
  comment: string;
}
