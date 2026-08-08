import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FundReleaseRequest } from './entities/fund-release-request.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectBudgetItem } from '../projects/entities/project-budget-item.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { RequestReleaseDto } from './dto/request-release.dto';
import { DecideReleaseDto } from './dto/decide-release.dto';
import { FundReleaseStatus, MovementKind, ProjectStatus, TicketStatus } from '../common/enums';
import { lockProject, lockWallet, lockWallets } from '../common/row-locks';
import { LedgerService, projectSpendable, projectTreasury, userBalance } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotifyInput } from '../notifications/notification-types';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class ProjectFundingService {
  constructor(
    @InjectRepository(FundReleaseRequest)
    private readonly requestsRepository: Repository<FundReleaseRequest>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectBudgetItem)
    private readonly budgetItemsRepository: Repository<ProjectBudgetItem>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly ticketsService: TicketsService,
    private readonly notifications: NotificationsService,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  private async assertFounder(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.founderId !== userId) throw new ForbiddenException('Not your project');
    return project;
  }

  async requestRelease(projectId: string, userId: string, dto: RequestReleaseDto) {
    const project = await this.assertFounder(projectId, userId);
    const item = await this.budgetItemsRepository.findOne({ where: { id: dto.budgetItemId, projectId } });
    if (!item) throw new NotFoundException('Budget item not found');
    if (item.released) throw new ConflictException('This stage has already been released');

    const pending = await this.requestsRepository.findOne({
      where: { budgetItemId: item.id, status: FundReleaseStatus.PENDING },
    });
    if (pending) throw new ConflictException('A release request for this stage is already pending');

    const request = this.requestsRepository.create({
      projectId,
      budgetItemId: item.id,
      amount: item.amount,
      note: dto.note ?? null,
    });
    const saved = await this.requestsRepository.save(request);
    // Money waiting on a decision: the founder cannot spend the stage until a
    // moderator looks, so the queue is the one place this must not sit silently.
    await this.notifications.notifyAdmins(NotificationType.MOD_FUND_RELEASE_REQUESTED, {
      projectId,
      projectTitle: project.title,
      stageTitle: item.title,
      amount: parseFloat(saved.amount),
    });
    return saved;
  }

  listForProject(projectId: string) {
    return this.requestsRepository.find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  // Moderator queue: pending requests across all projects, with project + stage.
  async listPending() {
    const requests = await this.requestsRepository.find({
      where: { status: FundReleaseStatus.PENDING },
      relations: { project: true, budgetItem: true },
      order: { createdAt: 'ASC' },
    });
    return requests.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectTitle: r.project?.title ?? {},
      budgetItemId: r.budgetItemId,
      stageTitle: r.budgetItem?.title ?? '',
      amount: parseFloat(r.amount),
      treasuryBalance: parseFloat(r.project?.treasuryBalance ?? '0'),
      note: r.note,
      createdAt: r.createdAt,
    }));
  }

  async decide(requestId: string, moderatorId: string, dto: DecideReleaseDto) {
    const decided = await this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(FundReleaseRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== FundReleaseStatus.PENDING) {
        throw new ConflictException('This request has already been decided');
      }

      request.decidedById = moderatorId;
      request.decidedAt = new Date();
      request.decisionNote = dto.note ?? null;

      if (!dto.approve) {
        request.status = FundReleaseStatus.REJECTED;
        return manager.save(request);
      }

      const project = await lockProject(manager, request.projectId);
      const amount = parseFloat(request.amount);
      if (parseFloat(project.treasuryBalance) < amount) {
        throw new BadRequestException('Project treasury does not hold enough funds for this stage yet');
      }

      // Move the stage's money from the frozen treasury to spendable, and mark
      // the stage released.
      project.treasuryBalance = (parseFloat(project.treasuryBalance) - amount).toFixed(2);
      project.spendableBalance = (parseFloat(project.spendableBalance) + amount).toFixed(2);
      await manager.save(project);

      // No user's wallet changes here, which is exactly why this movement had no
      // record before: `transactions` has nowhere to put a transfer between two of
      // a project's own accounts. It is still the moment investors' money stops
      // being frozen, so it is the one a moderator most needs to be able to find.
      await this.ledger.record(manager, {
        kind: MovementKind.STAGE_RELEASE,
        amount,
        from: projectTreasury(project.id),
        to: projectSpendable(project.id),
        description: `Stage release approved by moderator`,
      });

      const item = await manager.findOne(ProjectBudgetItem, { where: { id: request.budgetItemId } });
      if (item) {
        item.released = true;
        await manager.save(item);
      }

      request.status = FundReleaseStatus.APPROVED;
      return manager.save(request);
    });

    // Read outside the decision: naming the project and the stage is presentation,
    // and the release lock has no business being held for it.
    const [project, item] = await Promise.all([
      this.projectsRepository.findOne({ where: { id: decided.projectId } }),
      this.budgetItemsRepository.findOne({ where: { id: decided.budgetItemId } }),
    ]);
    if (project) {
      await this.notifications.notify({
        userId: project.founderId,
        type:
          decided.status === FundReleaseStatus.APPROVED
            ? NotificationType.FUND_RELEASE_APPROVED
            : NotificationType.FUND_RELEASE_REJECTED,
        payload: {
          projectId: project.id,
          projectTitle: project.title,
          stageTitle: item?.title ?? null,
          amount: parseFloat(decided.amount),
          comment: decided.decisionNote,
        },
      });
    }
    return decided;
  }

  // Founder pulls already-released project funds into their own wallet.
  async withdrawToWallet(projectId: string, userId: string, amount: number) {
    if (!amount || amount <= 0) throw new BadRequestException('Amount must be positive');
    const outcome = await this.dataSource.transaction(async (manager) => {
      const project = await lockProject(manager, projectId);
      if (project.founderId !== userId) throw new ForbiddenException('Not your project');
      if (parseFloat(project.spendableBalance) < amount) {
        throw new BadRequestException('Not enough released funds');
      }
      const wallet = await lockWallet(manager, userId);

      project.spendableBalance = (parseFloat(project.spendableBalance) - amount).toFixed(2);
      wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
      await manager.save(project);
      await manager.save(wallet);

      // Money leaving a project's books for a personal wallet, and until now the
      // one movement on the platform that nobody signed off on and nothing wrote
      // down. The founder's balance simply grew.
      await this.ledger.record(manager, {
        kind: MovementKind.FOUNDER_WITHDRAWAL,
        amount,
        from: projectSpendable(project.id),
        to: userBalance(userId),
        description: 'Founder moved released project funds to their wallet',
      });

      return {
        spendableBalance: parseFloat(project.spendableBalance),
        walletBalance: parseFloat(wallet.balance),
        projectTitle: project.title,
      };
    });

    // A receipt for the founder's own action. Worth a line because it is money
    // leaving a project's books for a personal wallet — the one movement here
    // that nobody else signs off on.
    await this.notifications.notify({
      userId,
      type: NotificationType.PROJECT_FUNDS_WITHDRAWN,
      payload: { projectId, projectTitle: outcome.projectTitle, amount },
    });
    const { projectTitle: _title, ...balances } = outcome;
    return balances;
  }

  // Moderator marks a project failed: whatever is still frozen in the treasury
  // is refunded to current ticket holders, in proportion to tickets held.
  async refundProject(projectId: string) {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id: projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Project not found');

      const treasuryCents = BigInt(Math.round(parseFloat(project.treasuryBalance) * 100));
      const tickets = await manager.find(Ticket, {
        where: [
          { projectId, status: TicketStatus.ACTIVE },
          { projectId, status: TicketStatus.LISTED_FOR_SALE },
        ],
      });
      const byHolder = new Map<string, number>();
      for (const ticket of tickets) {
        byHolder.set(ticket.ownerId, (byHolder.get(ticket.ownerId) ?? 0) + ticket.quantity);
      }
      const totalQty = [...byHolder.values()].reduce((sum, q) => sum + q, 0);

      let refundedCents = 0n;
      const refunds: Array<{ userId: string; amount: number }> = [];
      if (treasuryCents > 0n && totalQty > 0) {
        const wallets = await lockWallets(manager, [...byHolder.keys()]);
        for (const [userId, qty] of byHolder) {
          const share = (treasuryCents * BigInt(qty)) / BigInt(totalQty);
          if (share <= 0n) continue;
          const amount = Number(share) / 100;
          const wallet = wallets.get(userId)!;
          wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
          await manager.save(wallet);
          await this.ledger.record(manager, {
            kind: MovementKind.PROJECT_REFUND,
            amount,
            from: projectTreasury(projectId),
            to: userBalance(userId),
            description: `Refund of ${qty} ticket(s) after the project closed`,
          });
          refundedCents += share;
          refunds.push({ userId, amount });
        }
      }

      // Cent remainder from flooring stays in the treasury; the rest is drained.
      project.treasuryBalance = (Number(treasuryCents - refundedCents) / 100).toFixed(2);
      project.status = ProjectStatus.CLOSED;
      await manager.save(project);

      return {
        refundedTotal: Number(refundedCents) / 100,
        holders: refunds.length,
        refunds,
        founderId: project.founderId,
        projectTitle: project.title,
      };
    });

    const about = { projectId, projectTitle: outcome.projectTitle };
    const messages: NotifyInput[] = outcome.refunds.map((refund) => ({
      userId: refund.userId,
      type: NotificationType.PROJECT_REFUNDED,
      payload: { ...about, amount: refund.amount },
    }));
    // Holders whose share rounded to nothing get no refund line, but the project
    // closing under them is still their news.
    for (const holderId of new Set([outcome.founderId, ...(await this.ticketsService.holderIds(projectId))])) {
      if (outcome.refunds.some((refund) => refund.userId === holderId)) continue;
      messages.push({ userId: holderId, type: NotificationType.PROJECT_CLOSED, payload: about });
    }
    await this.notifications.notifyMany(messages);

    return { refundedTotal: outcome.refundedTotal, holders: outcome.holders };
  }
}
