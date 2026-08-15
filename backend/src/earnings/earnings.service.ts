import { Injectable, Logger } from '@nestjs/common';
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

  /**
   * Writes one valuation row per active ticket for today.
   *
   * **Not on a schedule, on purpose.** There is no valuation feed yet: `value` is the
   * ticket's own purchase price and `dailyReturn` is zero, every ticket, every day. The
   * portfolio already falls back to the purchase price when a ticket has no snapshot
   * (see PortfolioService), so a day with rows and a day without produce identical
   * figures on screen — down to the last decimal. What the nightly run was doing was
   * writing `tickets × days` rows that no reader can distinguish from their own absence,
   * on a database whose free tier is measured in hundreds of megabytes.
   *
   * Left as a method rather than deleted, because the day a real feed exists this is
   * where it plugs in: give it a source for `value`, put `@Cron(CronExpression.
   * EVERY_DAY_AT_MIDNIGHT)` back on it, and the history starts accumulating for a
   * reason. Two things to fix at that point, both of which only matter once the numbers
   * differ from each other:
   *
   *   - it is a query per ticket for the previous snapshot, so it costs a round trip per
   *     holding and should read the whole set in one go, the way the portfolio does;
   *   - a missed midnight leaves a hole in the history, and this catches up on nothing,
   *     so it wants the same treatment the daily draw got.
   *
   * `(ticket_id, date)` is unique in the database, so running this twice in one day is
   * refused by Postgres rather than quietly doubling a ticket's history.
   */
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
