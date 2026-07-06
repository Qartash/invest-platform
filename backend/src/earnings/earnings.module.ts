import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EarningsSnapshot } from './entities/earnings-snapshot.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { EarningsService } from './earnings.service';

@Module({
  imports: [TypeOrmModule.forFeature([EarningsSnapshot, Ticket])],
  providers: [EarningsService],
  exports: [EarningsService],
})
export class EarningsModule {}
