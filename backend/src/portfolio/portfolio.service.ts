import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { EarningsSnapshot } from '../earnings/entities/earnings-snapshot.entity';
import { TicketStatus } from '../common/enums';

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
  ) {}

  async getPortfolio(userId: string) {
    const tickets = await this.ticketsRepository.find({
      where: { ownerId: userId },
      relations: { project: true },
      order: { purchaseDate: 'ASC' },
    });

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

    for (const holding of groupedHoldings.values()) {
      holding.returnAmount = holding.currentValue - holding.purchasePrice;
      holding.returnPercent =
        holding.purchasePrice > 0 ? ((holding.currentValue - holding.purchasePrice) / holding.purchasePrice) * 100 : 0;
    }

    return {
      holdings,
      summary: {
        totalInvested,
        totalCurrentValue,
        totalReturnAmount: totalCurrentValue - totalInvested,
        totalReturnPercent:
          totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0,
        todayReturn,
        monthReturn,
      },
    };
  }
}
