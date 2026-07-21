import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { EarningsSnapshot } from '../earnings/entities/earnings-snapshot.entity';
import { ReportPayout } from '../project-finance/entities/report-payout.entity';
import { TicketStatus } from '../common/enums';

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface HoldingLot {
  ticketId: string;
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  returnAmount: number;
  purchaseDate: Date;
}

export interface Holding {
  ticketId: string;
  ticketIds: string[];
  projectId: string;
  projectTitle: Record<string, string>;
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  dividendsReceived: number;
  returnAmount: number;
  returnPercent: number;
  status: string;
  askingPrice: number | null;
  resaleEnabled: boolean;
  purchaseDate: Date;
  lastPurchaseDate: Date;
  lotsCount: number;
  lots: HoldingLot[];
}

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(EarningsSnapshot)
    private readonly snapshotsRepository: Repository<EarningsSnapshot>,
    @InjectRepository(ReportPayout)
    private readonly payoutsRepository: Repository<ReportPayout>,
  ) {}

  // Dividends this user has been paid, summed per project (payouts link to a
  // report, and a report belongs to a project). Portfolio return would
  // otherwise ignore real money earned, since the valuation feed is a
  // placeholder that carries purchase price forward with zero return.
  private async dividendsByProject(userId: string): Promise<Map<string, number>> {
    const rows: Array<{ projectId: string; total: string }> = await this.payoutsRepository
      .createQueryBuilder('payout')
      .innerJoin('project_financial_reports', 'report', 'report.id = payout.report_id')
      .select('report.project_id', 'projectId')
      .addSelect('COALESCE(SUM(payout.amount), 0)', 'total')
      .where('payout.user_id = :userId', { userId })
      .groupBy('report.project_id')
      .getRawMany();
    return new Map(rows.map((row) => [row.projectId, parseFloat(row.total)]));
  }

  async getPortfolio(userId: string) {
    const [tickets, dividendsByProject] = await Promise.all([
      this.ticketsRepository.find({
        where: { ownerId: userId },
        relations: { project: true },
        order: { purchaseDate: 'ASC' },
      }),
      this.dividendsByProject(userId),
    ]);

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let todayReturn = 0;
    let monthReturn = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

    // Tickets bought at the same unit price are separate purchase lots (one per `buyTicket`
    // call) but look identical to the investor, so ACTIVE ones are merged into a single
    // holding here; LISTED_FOR_SALE tickets stay one-per-row since each has its own listing.
    const groupedHoldings = new Map<string, Holding>();
    const holdings: Holding[] = [];

    for (const ticket of tickets) {
      const purchasePrice = parseFloat(ticket.purchasePrice);
      const latestSnapshot = await this.snapshotsRepository.findOne({
        where: { ticketId: ticket.id },
        order: { date: 'DESC' },
      });
      const currentValue = latestSnapshot ? parseFloat(latestSnapshot.value) : purchasePrice;

      const monthAgoSnapshot = await this.snapshotsRepository.findOne({
        where: { ticketId: ticket.id, date: thirtyDaysAgoStr },
      });
      const monthBaseline = monthAgoSnapshot ? parseFloat(monthAgoSnapshot.value) : purchasePrice;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdaySnapshot = await this.snapshotsRepository.findOne({
        where: { ticketId: ticket.id, date: yesterday.toISOString().slice(0, 10) },
      });
      const todayBaseline = yesterdaySnapshot ? parseFloat(yesterdaySnapshot.value) : purchasePrice;

      totalInvested += purchasePrice;
      totalCurrentValue += currentValue;
      todayReturn += currentValue - todayBaseline;
      monthReturn += currentValue - monthBaseline;

      const lot: HoldingLot = {
        ticketId: ticket.id,
        quantity: ticket.quantity,
        purchasePrice,
        currentValue,
        returnAmount: currentValue - purchasePrice,
        purchaseDate: ticket.purchaseDate,
      };

      if (ticket.status === TicketStatus.ACTIVE) {
        const unitPrice = Math.round((purchasePrice / ticket.quantity) * 100) / 100;
        const groupKey = `${ticket.projectId}:${unitPrice}`;
        const existing = groupedHoldings.get(groupKey);
        if (existing) {
          existing.quantity += ticket.quantity;
          existing.purchasePrice += purchasePrice;
          existing.currentValue += currentValue;
          existing.ticketIds.push(ticket.id);
          existing.lotsCount += 1;
          existing.lots.push(lot);
          if (ticket.purchaseDate < existing.purchaseDate) existing.purchaseDate = ticket.purchaseDate;
          if (ticket.purchaseDate > existing.lastPurchaseDate) existing.lastPurchaseDate = ticket.purchaseDate;
          continue;
        }
      }

      const holding: Holding = {
        ticketId: ticket.id,
        ticketIds: [ticket.id],
        projectId: ticket.projectId,
        projectTitle: ticket.project?.title ?? {},
        quantity: ticket.quantity,
        purchasePrice,
        currentValue,
        dividendsReceived: 0,
        returnAmount: currentValue - purchasePrice,
        returnPercent: purchasePrice > 0 ? ((currentValue - purchasePrice) / purchasePrice) * 100 : 0,
        status: ticket.status,
        askingPrice: ticket.askingPrice ? parseFloat(ticket.askingPrice) : null,
        resaleEnabled: ticket.project?.resaleEnabled ?? false,
        purchaseDate: ticket.purchaseDate,
        lastPurchaseDate: ticket.purchaseDate,
        lotsCount: 1,
        lots: [lot],
      };
      holdings.push(holding);
      if (ticket.status === TicketStatus.ACTIVE) {
        const unitPrice = Math.round((purchasePrice / ticket.quantity) * 100) / 100;
        groupedHoldings.set(`${ticket.projectId}:${unitPrice}`, holding);
      }
    }

    // Spread each project's dividends across that project's holding cards in
    // proportion to quantity, so the per-card returns sum back to the project
    // total without double counting when a project shows as several lots.
    const heldQtyByProject = new Map<string, number>();
    for (const holding of holdings) {
      heldQtyByProject.set(holding.projectId, (heldQtyByProject.get(holding.projectId) ?? 0) + holding.quantity);
    }
    for (const holding of holdings) {
      const projectDividends = dividendsByProject.get(holding.projectId) ?? 0;
      const projectQty = heldQtyByProject.get(holding.projectId) ?? 0;
      // Splitting a project's dividends across the lots that earned them rarely divides
      // evenly, so round here rather than shipping 2516.4772727272725 for the client to
      // guess at. Money to the cent, percentages to two places.
      holding.dividendsReceived = round2(
        projectQty > 0 ? (projectDividends * holding.quantity) / projectQty : 0,
      );
    }

    for (const holding of holdings) {
      // Merged lots accumulate in floating point, so a card can arrive here holding
      // 236959.74000000002. Settle every figure to the cent once, at the end.
      holding.purchasePrice = round2(holding.purchasePrice);
      holding.currentValue = round2(holding.currentValue);
      holding.returnAmount = round2(holding.currentValue - holding.purchasePrice + holding.dividendsReceived);
      holding.returnPercent = round2(
        holding.purchasePrice > 0 ? (holding.returnAmount / holding.purchasePrice) * 100 : 0,
      );
      for (const lot of holding.lots) {
        lot.purchasePrice = round2(lot.purchasePrice);
        lot.currentValue = round2(lot.currentValue);
        lot.returnAmount = round2(lot.returnAmount);
      }
    }

    // All dividends the user was ever paid, even for projects they have since
    // fully sold out of — those earnings are real and belong in the total.
    const totalDividends = round2([...dividendsByProject.values()].reduce((sum, amount) => sum + amount, 0));
    const totalReturnAmount = round2(totalCurrentValue - totalInvested + totalDividends);

    return {
      holdings,
      summary: {
        totalInvested: round2(totalInvested),
        totalCurrentValue: round2(totalCurrentValue),
        totalDividends,
        totalReturnAmount,
        totalReturnPercent: round2(totalInvested > 0 ? (totalReturnAmount / totalInvested) * 100 : 0),
        todayReturn: round2(todayReturn),
        monthReturn: round2(monthReturn),
      },
    };
  }
}
