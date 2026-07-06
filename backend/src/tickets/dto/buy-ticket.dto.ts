import { IsInt, IsPositive, IsUUID } from 'class-validator';

export class BuyTicketDto {
  @IsUUID()
  projectId: string;

  @IsInt()
  @IsPositive()
  quantity: number;
}
