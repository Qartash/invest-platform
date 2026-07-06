import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { BuyTicketDto } from './dto/buy-ticket.dto';
import { ListTicketDto } from './dto/list-ticket.dto';
import { BuyListingDto } from './dto/buy-listing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.ticketsService.findByOwner(user.id);
  }

  @Post('buy')
  buy(@CurrentUser() user: User, @Body() dto: BuyTicketDto) {
    return this.ticketsService.buyTicket(user.id, dto);
  }

  @Patch('list')
  list(@CurrentUser() user: User, @Body() dto: ListTicketDto) {
    return this.ticketsService.listForSale(dto.ticketIds, user.id, dto.quantity, dto.askingPrice);
  }

  @Patch(':id/unlist')
  unlist(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ticketsService.cancelListing(id, user.id);
  }

  @Post(':id/buy-listing')
  buyListing(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: BuyListingDto) {
    return this.ticketsService.buyListing(id, user.id, dto.quantity);
  }
}
