import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class ListTicketDto {
  // Ticket ids are uuids, and saying so here is what stops anything else reaching a uuid
  // column and coming back as a driver error. The ceiling is the other half: unbounded, one
  // request could name every ticket on the platform and have the service walk all of them.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  @IsString({ each: true })
  ticketIds: string[];

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  askingPrice: number;
}
