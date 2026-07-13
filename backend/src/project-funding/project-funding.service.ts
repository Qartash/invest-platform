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
import { Wallet } from '../wallets/entities/wallet.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { RequestReleaseDto } from './dto/request-release.dto';
import { DecideReleaseDto } from './dto/decide-release.dto';
import { FundReleaseStatus, ProjectStatus, TicketStatus } from '../common/enums';

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
    private readonly dataSource: DataSource,
  ) {}

  private async assertFounder(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.founderId !== userId) throw new ForbiddenException('Not your project');
    return project;
  }

  async requestRelease(projectId: string, userId: string, dto: RequestReleaseDto) {
    await this.assertFounder(projectId, userId);
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
    return this.requestsRepository.save(request);
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
    return this.dataSource.transaction(async (manager) => {
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

      const project = await manager.findOne(Project, { where: { id: request.projectId } });
      if (!project) throw new NotFoundException('Project not found');
      const amount = parseFloat(request.amount);
      if (parseFloat(project.treasuryBalance) < amount) {
        throw new BadRequestException('Project treasury does not hold enough funds for this stage yet');
      }

      // Move the stage's money from the frozen treasury to spendable, and mark
      // the stage released.
      project.treasuryBalance = (parseFloat(project.treasuryBalance) - amount).toFixed(2);
      project.spendableBalance = (parseFloat(project.spendableBalance) + amount).toFixed(2);
      await manager.save(project);

      const item = await manager.findOne(ProjectBudgetItem, { where: { id: request.budgetItemId } });
      if (item) {
        item.released = true;
        await manager.save(item);
      }

      request.status = FundReleaseStatus.APPROVED;
      return manager.save(request);
    });
  }

  // Founder pulls already-released project funds into their own wallet.
  async withdrawToWallet(projectId: string, userId: string, amount: number) {
    if (!amount || amount <= 0) throw new BadRequestException('Amount must be positive');
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.founderId !== userId) throw new ForbiddenException('Not your project');
      if (parseFloat(project.spendableBalance) < amount) {
        throw new BadRequestException('Not enough released funds');
      }
      const wallet = await manager.findOne(Wallet, { where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      project.spendableBalance = (parseFloat(project.spendableBalance) - amount).toFixed(2);
      wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
      await manager.save(project);
      await manager.save(wallet);
      return { spendableBalance: parseFloat(project.spendableBalance), walletBalance: parseFloat(wallet.balance) };
    });
  }

  // Moderator marks a project failed: whatever is still frozen in the treasury
  // is refunded to current ticket holders, in proportion to tickets held.
  async refundProject(projectId: string) {
    return this.dataSource.transaction(async (manager) => {
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
        for (const [userId, qty] of byHolder) {
          const share = (treasuryCents * BigInt(qty)) / BigInt(totalQty);
          if (share <= 0n) continue;
          const amount = Number(share) / 100;
          let wallet = await manager.findOne(Wallet, { where: { userId } });
          if (!wallet) {
            wallet = manager.create(Wallet, { userId, balance: '0', currency: 'AMD' });
          }
          wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
          await manager.save(wallet);
          refundedCents += share;
          refunds.push({ userId, amount });
        }
      }

      // Cent remainder from flooring stays in the treasury; the rest is drained.
      project.treasuryBalance = (Number(treasuryCents - refundedCents) / 100).toFixed(2);
      project.status = ProjectStatus.CLOSED;
      await manager.save(project);

      return { refundedTotal: Number(refundedCents) / 100, holders: refunds.length };
    });
  }
}
