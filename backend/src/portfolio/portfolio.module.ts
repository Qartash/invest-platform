import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { EarningsSnapshot } from '../earnings/entities/earnings-snapshot.entity';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, EarningsSnapshot])],
  providers: [PortfolioService],
  controllers: [PortfolioController],
})
export class PortfolioModule {}
