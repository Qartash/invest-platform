import { IsIn } from 'class-validator';

export class SetPriorityDto {
  @IsIn(['low', 'medium', 'high'])
  priority: string;
}
