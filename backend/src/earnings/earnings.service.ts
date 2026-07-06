import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EarningsSnapshot } from './entities/earnings-snapshot.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { TicketStatus } from '../common/enums';

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(
    @InjectRepository(EarningsSnapshot)
    private readonly snapshotsRepository: Repository<EarningsSnapshot>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySnapshots(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const tickets = await this.ticketsRepository.find({ where: { status: TicketStatus.ACTIVE } });

    for (const ticket of tickets) {
      const lastSnapshot = await this.snapshotsRepository.findOne({
        where: { ticketId: ticket.id },
        order: { date: 'DESC' },
      });
      // No live valuation feed yet — carry the last known value forward with zero
      // return until founders start publishing real project performance data.
      const value = lastSnapshot ? lastSnapshot.value : ticket.purchasePrice;
      const snapshot = this.snapshotsRepository.create({
        ticketId: ticket.id,
        date: today,
        value,
        dailyReturn: '0',
      });
      await this.snapshotsRepository.save(snapshot);
    }
    this.logger.log(`Generated ${tickets.length} earnings snapshots for ${today}`);
  }
}
