import { ArrayMinSize, IsArray, IsNumber, IsPositive, IsString } from 'class-validator';

export class ListTicketDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ticketIds: string[];

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  askingPrice: number;
}
