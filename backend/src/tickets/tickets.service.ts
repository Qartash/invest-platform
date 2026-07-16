import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { EarningsSnapshot } from '../earnings/entities/earnings-snapshot.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Project } from '../projects/entities/project.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BuyTicketDto } from './dto/buy-ticket.dto';
import { ProjectStatus, TicketStatus, TransactionStatus, TransactionType } from '../common/enums';
import { computeTicketPricing, computeTicketPurchaseCost } from '../projects/pricing';

@Injectable()
export class TicketsService {
  constructor(private readonly dataSource: DataSource) {}

  // The valuation feed is a flat placeholder: a ticket's snapshot value always
  // equals its purchase price (zero return until a real feed exists). So whenever
  // a ticket's purchase price is rebased on the same row — a resale portion split
  // off, or the row transferred to a buyer at the asking price — its existing
  // snapshots must be reset to the new price, or the portfolio reads a stale value
  // against the new price and reports a phantom gain/loss.
  private resyncSnapshots(manager: EntityManager, ticketId: string, value: string): Promise<unknown> {
    return manager.update(EarningsSnapshot, { ticketId }, { value });
  }

  async buyTicket(userId: string, dto: BuyTicketDto): Promise<Ticket> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: dto.projectId } });
      if (!project) {
        throw new BadRequestException('Project not found');
      }
      if (project.status !== ProjectStatus.ACTIVE) {
        throw new BadRequestException('Project is not open for investment');
      }
      const remainingTickets = project.totalTickets - project.ticketsSold;
      if (dto.quantity > remainingTickets) {
        throw new BadRequestException('Not enough tickets available');
      }

      const { tiers } = computeTicketPricing(project);
      const totalCost = computeTicketPurchaseCost(tiers, project.ticketsSold, dto.quantity);

      const wallet = await manager.findOne(Wallet, { where: { userId } });
      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }
      // Invest credit (earned from work, non-withdrawable) is spent first, then
      // the withdrawable balance covers the rest.
      const credit = parseFloat(wallet.investCredit);
      const currentBalance = parseFloat(wallet.balance);
      if (credit + currentBalance < totalCost) {
        throw new BadRequestException('Insufficient wallet balance');
      }
      const fromCredit = Math.min(credit, totalCost);
      wallet.investCredit = (credit - fromCredit).toFixed(2);
      wallet.balance = (currentBalance - (totalCost - fromCredit)).toFixed(2);
      await manager.save(wallet);

      project.collectedAmount = (parseFloat(project.collectedAmount) + totalCost).toFixed(2);
      // Investor money is held in the project treasury (escrow), not handed to
      // the founder — it's released to spendable per stage by a moderator.
      project.treasuryBalance = (parseFloat(project.treasuryBalance) + totalCost).toFixed(2);
      project.ticketsSold += dto.quantity;
      if (project.ticketsSold >= project.totalTickets) {
        project.status = ProjectStatus.FUNDED;
      }
      await manager.save(project);

      const ticket = manager.create(Ticket, {
        projectId: project.id,
        ownerId: userId,
        quantity: dto.quantity,
        purchasePrice: totalCost.toFixed(2),
      });
      const savedTicket = await manager.save(ticket);

      const transaction = manager.create(Transaction, {
        userId,
        type: TransactionType.BUY,
        ticketId: savedTicket.id,
        amount: totalCost.toFixed(2),
        quantity: dto.quantity,
        status: TransactionStatus.COMPLETED,
      });
      await manager.save(transaction);

      return savedTicket;
    });
  }

  findByOwner(ownerId: string): Promise<Ticket[]> {
    return this.dataSource.getRepository(Ticket).find({
      where: { ownerId },
      relations: { project: true },
      order: { purchaseDate: 'DESC' },
    });
  }

  async findPurchasesByProject(projectId: string) {
    const tickets = await this.dataSource.getRepository(Ticket).find({
      where: { projectId },
      relations: { owner: true },
      order: { purchaseDate: 'ASC' },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      buyerId: ticket.ownerId,
      buyerName: ticket.owner.fullName || ticket.owner.username || ticket.owner.email,
      buyerEmail: ticket.owner.email,
      quantity: ticket.quantity,
      unitPrice: parseFloat(ticket.purchasePrice) / ticket.quantity,
      totalPrice: parseFloat(ticket.purchasePrice),
      purchaseDate: ticket.purchaseDate,
      // These are current holdings, not a log of what the project sold: a resold ticket
      // reports its secondary price and its new owner, and the original purchase it
      // replaced is gone. Callers showing what the project raised must use the project's
      // collectedAmount rather than summing these.
      isResale: ticket.acquiredViaResale,
    }));
  }

  async countInvestors(projectId: string): Promise<number> {
    const result = await this.dataSource
      .getRepository(Ticket)
      .createQueryBuilder('ticket')
      .select('COUNT(DISTINCT ticket.owner_id)', 'count')
      .where('ticket.project_id = :projectId', { projectId })
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  async getResaleStats(projectId: string): Promise<{ listingsCount: number; ticketsCount: number }> {
    const result = await this.dataSource
      .getRepository(Ticket)
      .createQueryBuilder('ticket')
      .select('COUNT(*)', 'listingsCount')
      .addSelect('COALESCE(SUM(ticket.quantity), 0)', 'ticketsCount')
      .where('ticket.project_id = :projectId', { projectId })
      .andWhere('ticket.status = :status', { status: TicketStatus.LISTED_FOR_SALE })
      .getRawOne<{ listingsCount: string; ticketsCount: string }>();
    return {
      listingsCount: parseInt(result?.listingsCount ?? '0', 10),
      ticketsCount: parseInt(result?.ticketsCount ?? '0', 10),
    };
  }

  // ticketIds may span several purchase lots for the same project (grouped together in the
  // portfolio view because they share a unit price). Listing consumes them oldest-first and,
  // when quantity doesn't consume a lot fully, splits it into a kept (still ACTIVE) remainder
  // and a new LISTED_FOR_SALE row, so only the requested quantity goes up for resale.
  async listForSale(ticketIds: string[], ownerId: string, quantity: number, askingPrice: number): Promise<Ticket[]> {
    return this.dataSource.transaction(async (manager) => {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('Quantity must be a positive integer');
      }
      if (askingPrice <= 0) {
        throw new BadRequestException('Asking price must be positive');
      }

      const tickets = await manager.find(Ticket, { where: { id: In(ticketIds) } });
      if (tickets.length !== ticketIds.length) {
        throw new NotFoundException('Ticket not found');
      }
      if (tickets.some((ticket) => ticket.ownerId !== ownerId)) {
        throw new ForbiddenException('Not your ticket');
      }
      if (tickets.some((ticket) => ticket.status !== TicketStatus.ACTIVE)) {
        throw new BadRequestException('Ticket is not available to list');
      }
      const projectId = tickets[0].projectId;
      if (tickets.some((ticket) => ticket.projectId !== projectId)) {
        throw new BadRequestException('Tickets belong to different projects');
      }

      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project?.resaleEnabled) {
        throw new BadRequestException('Resale is not enabled for this project');
      }

      const totalAvailable = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
      if (quantity > totalAvailable) {
        throw new BadRequestException('Not enough tickets to list');
      }

      tickets.sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());

      let remaining = quantity;
      const listedTickets: Ticket[] = [];

      for (const ticket of tickets) {
        if (remaining <= 0) break;

        const ticketsToList = Math.min(ticket.quantity, remaining);
        const unitCost = parseFloat(ticket.purchasePrice) / ticket.quantity;
        const listedCost = unitCost * ticketsToList;
        const listedAskingPrice = (askingPrice * ticketsToList) / quantity;

        if (ticketsToList === ticket.quantity) {
          ticket.status = TicketStatus.LISTED_FOR_SALE;
          ticket.askingPrice = listedAskingPrice.toFixed(2);
          listedTickets.push(await manager.save(ticket));
        } else {
          ticket.quantity -= ticketsToList;
          ticket.purchasePrice = (parseFloat(ticket.purchasePrice) - listedCost).toFixed(2);
          await manager.save(ticket);
          // Kept remainder's cost basis shrank; realign its snapshots so the
          // portfolio doesn't read the pre-split (larger) value as a gain.
          await this.resyncSnapshots(manager, ticket.id, ticket.purchasePrice);

          const listing = manager.create(Ticket, {
            projectId: ticket.projectId,
            ownerId: ticket.ownerId,
            quantity: ticketsToList,
            purchasePrice: listedCost.toFixed(2),
            status: TicketStatus.LISTED_FOR_SALE,
            askingPrice: listedAskingPrice.toFixed(2),
          });
          listedTickets.push(await manager.save(listing));
        }

        remaining -= ticketsToList;
      }

      return listedTickets;
    });
  }

  async cancelListing(ticketId: string, ownerId: string): Promise<Ticket> {
    const ticket = await this.dataSource.getRepository(Ticket).findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.ownerId !== ownerId) {
      throw new ForbiddenException('Not your ticket');
    }
    if (ticket.status !== TicketStatus.LISTED_FOR_SALE) {
      throw new BadRequestException('Ticket is not listed for sale');
    }
    ticket.status = TicketStatus.ACTIVE;
    ticket.askingPrice = null;
    return this.dataSource.getRepository(Ticket).save(ticket);
  }

  async findListingsByProject(projectId: string) {
    const tickets = await this.dataSource.getRepository(Ticket).find({
      where: { projectId, status: TicketStatus.LISTED_FOR_SALE },
      relations: { owner: true },
      order: { purchaseDate: 'ASC' },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      sellerId: ticket.ownerId,
      sellerName: ticket.owner.fullName || ticket.owner.username || ticket.owner.email,
      quantity: ticket.quantity,
      askingPrice: parseFloat(ticket.askingPrice ?? '0'),
      unitPrice: parseFloat(ticket.askingPrice ?? '0') / ticket.quantity,
    }));
  }

  // quantity lets a buyer take less than the full listing (not enough funds for all of it,
  // or they simply want fewer). A partial buy splits the listing: the bought portion becomes
  // a new ACTIVE ticket for the buyer, and the remainder stays LISTED_FOR_SALE under the seller.
  async buyListing(listingId: string, buyerId: string, quantity?: number): Promise<Ticket> {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, { where: { id: listingId } });
      if (!ticket || ticket.status !== TicketStatus.LISTED_FOR_SALE || !ticket.askingPrice) {
        throw new BadRequestException('Listing not found');
      }
      if (ticket.ownerId === buyerId) {
        throw new BadRequestException('Cannot buy your own listing');
      }

      const purchaseQuantity = quantity ?? ticket.quantity;
      if (!Number.isInteger(purchaseQuantity) || purchaseQuantity <= 0 || purchaseQuantity > ticket.quantity) {
        throw new BadRequestException('Invalid quantity');
      }

      const totalAskingPrice = parseFloat(ticket.askingPrice);
      const isFullPurchase = purchaseQuantity === ticket.quantity;
      const price = isFullPurchase
        ? totalAskingPrice
        : Math.round(((totalAskingPrice / ticket.quantity) * purchaseQuantity) * 100) / 100;

      const buyerWallet = await manager.findOne(Wallet, { where: { userId: buyerId } });
      if (!buyerWallet) {
        throw new BadRequestException('Wallet not found');
      }
      const buyerBalance = parseFloat(buyerWallet.balance);
      if (buyerBalance < price) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const sellerWallet = await manager.findOne(Wallet, { where: { userId: ticket.ownerId } });
      if (!sellerWallet) {
        throw new BadRequestException('Seller wallet not found');
      }

      buyerWallet.balance = (buyerBalance - price).toFixed(2);
      sellerWallet.balance = (parseFloat(sellerWallet.balance) + price).toFixed(2);
      await manager.save(buyerWallet);
      await manager.save(sellerWallet);

      const sellerId = ticket.ownerId;
      let purchasedTicket: Ticket;

      if (isFullPurchase) {
        ticket.ownerId = buyerId;
        ticket.status = TicketStatus.ACTIVE;
        ticket.purchasePrice = ticket.askingPrice;
        ticket.askingPrice = null;
        // The row now describes a secondary holding: its price is what this buyer paid
        // another investor, not what the project ever collected for it.
        ticket.acquiredViaResale = true;
        purchasedTicket = await manager.save(ticket);
        // Row is reused for the buyer at a new cost basis (the price paid); drop
        // the seller-era snapshots so the buyer doesn't inherit a phantom return.
        await this.resyncSnapshots(manager, ticket.id, ticket.purchasePrice);
      } else {
        // Seller's remaining listed portion keeps a proportional slice of the
        // original cost basis, so its snapshots stay aligned if it's later relisted
        // or the listing is cancelled back to an active holding.
        const remainingQuantity = ticket.quantity - purchaseQuantity;
        const remainingCost = (parseFloat(ticket.purchasePrice) * remainingQuantity) / ticket.quantity;
        ticket.quantity = remainingQuantity;
        ticket.purchasePrice = remainingCost.toFixed(2);
        ticket.askingPrice = (totalAskingPrice - price).toFixed(2);
        await manager.save(ticket);
        await this.resyncSnapshots(manager, ticket.id, ticket.purchasePrice);

        purchasedTicket = await manager.save(
          manager.create(Ticket, {
            projectId: ticket.projectId,
            ownerId: buyerId,
            quantity: purchaseQuantity,
            purchasePrice: price.toFixed(2),
            status: TicketStatus.ACTIVE,
            acquiredViaResale: true,
          }),
        );
      }

      await manager.save(
        manager.create(Transaction, {
          userId: sellerId,
          type: TransactionType.SELL,
          ticketId: purchasedTicket.id,
          amount: price.toFixed(2),
          quantity: purchaseQuantity,
          status: TransactionStatus.COMPLETED,
        }),
      );
      await manager.save(
        manager.create(Transaction, {
          userId: buyerId,
          type: TransactionType.BUY,
          ticketId: purchasedTicket.id,
          amount: price.toFixed(2),
          quantity: purchaseQuantity,
          status: TransactionStatus.COMPLETED,
        }),
      );

      return purchasedTicket;
    });
  }

  async findActiveProjectsForOwner(ownerId: string) {
    const tickets = await this.dataSource.getRepository(Ticket).find({
      where: { ownerId },
      relations: { project: true },
    });
    const seen = new Set<string>();
    const projects: Array<{ id: string; title: Project['title']; coverImageUrl: string | null; status: ProjectStatus }> = [];
    for (const ticket of tickets) {
      const project = ticket.project;
      if (!project) continue;
      if (project.status !== ProjectStatus.ACTIVE && project.status !== ProjectStatus.FUNDED) continue;
      if (seen.has(project.id)) continue;
      seen.add(project.id);
      projects.push({
        id: project.id,
        title: project.title,
        coverImageUrl: project.coverImageUrl,
        status: project.status,
      });
    }
    return projects;
  }
}
