import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectWork } from './entities/project-work.entity';
import { WorkApplication } from './entities/work-application.entity';
import { WorkReview } from './entities/work-review.entity';
import { WorkMilestone } from './entities/work-milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ProjectExpense } from '../project-finance/entities/project-expense.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CreateWorkDto } from './dto/create-work.dto';
import { ApplyWorkDto } from './dto/apply-work.dto';
import {
  ExpenseCategory,
  MilestoneStatus,
  TransactionStatus,
  TransactionType,
  WorkApplicationStatus,
  WorkPaymentType,
  WorkStatus,
} from '../common/enums';
import { EntityManager } from 'typeorm';

@Injectable()
export class ProjectWorksService {
  constructor(
    @InjectRepository(ProjectWork)
    private readonly worksRepository: Repository<ProjectWork>,
    @InjectRepository(WorkApplication)
    private readonly applicationsRepository: Repository<WorkApplication>,
    @InjectRepository(WorkReview)
    private readonly reviewsRepository: Repository<WorkReview>,
    @InjectRepository(WorkMilestone)
    private readonly milestonesRepository: Repository<WorkMilestone>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly dataSource: DataSource,
  ) {}

  // Pays a slice of a work's escrow to the assignee, into the right bucket:
  // cash to the withdrawable balance, tickets to the invest credit.
  private async payToWorker(manager: EntityManager, work: ProjectWork, amount: number) {
    const wallet = await manager.findOne(Wallet, { where: { userId: work.assigneeId! } });
    if (!wallet) throw new NotFoundException('Worker wallet not found');
    if (work.assigneePayment === WorkPaymentType.TICKETS) {
      wallet.investCredit = (parseFloat(wallet.investCredit) + amount).toFixed(2);
    } else {
      wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
    }
    await manager.save(wallet);

    // Record the payout as a project expense so it shows up in the finance
    // report (dated today, its own "work" category).
    await manager.save(
      manager.create(ProjectExpense, {
        projectId: work.projectId,
        amount: amount.toFixed(2),
        category: ExpenseCategory.WORK,
        description: work.title,
        date: new Date().toISOString().slice(0, 10),
      }),
    );

    // And a wallet transaction for the worker so the money has a visible source
    // in their operations history.
    await manager.save(
      manager.create(Transaction, {
        userId: work.assigneeId!,
        type: TransactionType.WORK_PAYMENT,
        amount: amount.toFixed(2),
        status: TransactionStatus.COMPLETED,
      }),
    );
  }

  private async assertFounder(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.founderId !== userId) throw new ForbiddenException('Not your project');
    return project;
  }

  private priceOf(work: ProjectWork, application?: WorkApplication | null): number {
    return parseFloat(application?.offeredPrice ?? work.price);
  }

  async listWorks(projectId: string, currentUserId?: string) {
    const works = await this.worksRepository.find({ where: { projectId }, order: { createdAt: 'DESC' } });
    if (works.length === 0) return [];
    const ids = works.map((w) => w.id);
    const counts: Array<{ work_id: string; count: string }> = await this.applicationsRepository
      .createQueryBuilder('a')
      .select('a.work_id', 'work_id')
      .addSelect('COUNT(*)', 'count')
      .where('a.work_id IN (:...ids)', { ids })
      .groupBy('a.work_id')
      .getRawMany();
    const countByWork = new Map(counts.map((c) => [c.work_id, parseInt(c.count, 10)]));

    // The caller's own application per work, so the app can show "you applied"
    // and let them edit it instead of re-applying.
    const mine = currentUserId
      ? await this.applicationsRepository.find({ where: ids.map((id) => ({ workId: id, applicantId: currentUserId })) })
      : [];
    const myByWork = new Map(mine.map((a) => [a.workId, a]));

    return works.map((w) => {
      const myApp = myByWork.get(w.id);
      return {
        id: w.id,
        projectId: w.projectId,
        budgetItemId: w.budgetItemId,
        title: w.title,
        brief: w.brief,
        price: parseFloat(w.price),
        paymentType: w.paymentType,
        allowCounterOffers: w.allowCounterOffers,
        ticketPremiumPercent: parseFloat(w.ticketPremiumPercent),
        status: w.status,
        assigneeId: w.assigneeId,
        assigneePayment: w.assigneePayment,
        escrowAmount: w.escrowAmount === null ? null : parseFloat(w.escrowAmount),
        deadline: w.deadline,
        applicationsCount: countByWork.get(w.id) ?? 0,
        myApplication: myApp
          ? {
              status: myApp.status,
              coverLetter: myApp.coverLetter,
              offeredPrice: myApp.offeredPrice === null ? null : parseFloat(myApp.offeredPrice),
              preferredPayment: myApp.preferredPayment,
              decisionReason: myApp.decisionReason,
            }
          : null,
        createdAt: w.createdAt,
      };
    });
  }

  async createWork(projectId: string, userId: string, dto: CreateWorkDto) {
    await this.assertFounder(projectId, userId);
    const work = this.worksRepository.create({
      projectId,
      budgetItemId: dto.budgetItemId ?? null,
      title: dto.title,
      brief: dto.brief,
      price: dto.price.toFixed(2),
      paymentType: dto.paymentType ?? WorkPaymentType.CASH,
      allowCounterOffers: dto.allowCounterOffers ?? false,
      ticketPremiumPercent: (dto.ticketPremiumPercent ?? 0).toFixed(2),
      deadline: dto.deadline ?? null,
      status: WorkStatus.OPEN,
    });
    return this.worksRepository.save(work);
  }

  async updateWork(projectId: string, workId: string, userId: string, dto: CreateWorkDto) {
    await this.assertFounder(projectId, userId);
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.status !== WorkStatus.OPEN) throw new ConflictException('Only an open work can be edited');
    if (dto.title !== undefined) work.title = dto.title;
    if (dto.brief !== undefined) work.brief = dto.brief;
    if (dto.price !== undefined) work.price = dto.price.toFixed(2);
    if (dto.paymentType !== undefined) work.paymentType = dto.paymentType;
    if (dto.allowCounterOffers !== undefined) work.allowCounterOffers = dto.allowCounterOffers;
    if (dto.ticketPremiumPercent !== undefined) work.ticketPremiumPercent = dto.ticketPremiumPercent.toFixed(2);
    if (dto.budgetItemId !== undefined) work.budgetItemId = dto.budgetItemId ?? null;
    if (dto.deadline !== undefined) work.deadline = dto.deadline ?? null;
    return this.worksRepository.save(work);
  }

  async deleteWork(projectId: string, workId: string, userId: string) {
    await this.assertFounder(projectId, userId);
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.status !== WorkStatus.OPEN) {
      throw new ConflictException('Only an open work with no assignee can be deleted');
    }
    await this.worksRepository.remove(work);
  }

  async apply(projectId: string, workId: string, userId: string, dto: ApplyWorkDto) {
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.status !== WorkStatus.OPEN) throw new ConflictException('This work is no longer open');
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (project?.founderId === userId) throw new BadRequestException('You cannot apply to your own project');
    if (dto.offeredPrice !== undefined && !work.allowCounterOffers) {
      throw new BadRequestException('This work does not accept counter-offers');
    }
    const existing = await this.applicationsRepository.findOne({ where: { workId, applicantId: userId } });
    if (existing) throw new ConflictException('You have already applied to this work');

    const application = this.applicationsRepository.create({
      workId,
      applicantId: userId,
      coverLetter: dto.coverLetter ?? null,
      offeredPrice: dto.offeredPrice !== undefined ? dto.offeredPrice.toFixed(2) : null,
      preferredPayment: dto.preferredPayment ?? WorkPaymentType.CASH,
    });
    return this.applicationsRepository.save(application);
  }

  // Applicant edits their own still-pending application.
  async updateApplication(projectId: string, workId: string, userId: string, dto: ApplyWorkDto) {
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    const app = await this.applicationsRepository.findOne({ where: { workId, applicantId: userId } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== WorkApplicationStatus.PENDING) {
      throw new ConflictException('This application can no longer be changed');
    }
    if (dto.offeredPrice !== undefined && !work.allowCounterOffers) {
      throw new BadRequestException('This work does not accept counter-offers');
    }
    if (dto.coverLetter !== undefined) app.coverLetter = dto.coverLetter || null;
    if (dto.offeredPrice !== undefined) app.offeredPrice = dto.offeredPrice.toFixed(2);
    if (dto.preferredPayment !== undefined) app.preferredPayment = dto.preferredPayment;
    return this.applicationsRepository.save(app);
  }

  // Founder rejects one application, with a reason shown to the applicant.
  async rejectApplication(projectId: string, workId: string, appId: string, userId: string, reason?: string) {
    await this.assertFounder(projectId, userId);
    const app = await this.applicationsRepository.findOne({ where: { id: appId, workId } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status === WorkApplicationStatus.SELECTED) {
      throw new ConflictException('A selected application cannot be rejected');
    }
    app.status = WorkApplicationStatus.REJECTED;
    app.decisionReason = reason ?? null;
    return this.applicationsRepository.save(app);
  }

  async listApplications(projectId: string, workId: string, userId: string) {
    await this.assertFounder(projectId, userId);
    const applications = await this.applicationsRepository.find({
      where: { workId },
      relations: { applicant: true },
      order: { createdAt: 'ASC' },
    });
    return applications.map((a) => ({
      id: a.id,
      applicantId: a.applicantId,
      fullName: a.applicant.showFullName ? a.applicant.fullName : null,
      username: a.applicant.username,
      avatarUrl: a.applicant.avatarUrl,
      avatarEmoji: a.applicant.avatarEmoji,
      coverLetter: a.coverLetter,
      offeredPrice: a.offeredPrice === null ? null : parseFloat(a.offeredPrice),
      preferredPayment: a.preferredPayment,
      status: a.status,
      decisionReason: a.decisionReason,
      createdAt: a.createdAt,
    }));
  }

  // Founder picks an applicant: the agreed amount is frozen from the project's
  // spendable (already-released) balance into the work's escrow.
  async selectApplicant(projectId: string, workId: string, applicationId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.founderId !== userId) throw new ForbiddenException('Not your project');

      const work = await manager.findOne(ProjectWork, { where: { id: workId, projectId } });
      if (!work) throw new NotFoundException('Work not found');
      if (work.status !== WorkStatus.OPEN) throw new ConflictException('This work already has an assignee');

      const application = await manager.findOne(WorkApplication, { where: { id: applicationId, workId } });
      if (!application) throw new NotFoundException('Application not found');

      // The work's payment type wins; only 'either' lets the applicant choose.
      const payment =
        work.paymentType === WorkPaymentType.EITHER ? application.preferredPayment : work.paymentType;
      const base = this.priceOf(work, application);
      // Taking tickets earns the premium — the project pays a bit more but keeps
      // the money as a stake rather than cash walking out.
      const amount =
        payment === WorkPaymentType.TICKETS
          ? Math.round(base * (1 + parseFloat(work.ticketPremiumPercent) / 100) * 100) / 100
          : base;
      if (parseFloat(project.spendableBalance) < amount) {
        throw new BadRequestException('Not enough released funds — request a stage release first');
      }

      project.spendableBalance = (parseFloat(project.spendableBalance) - amount).toFixed(2);
      await manager.save(project);

      work.assigneeId = application.applicantId;
      work.assigneePayment = payment;
      work.escrowAmount = amount.toFixed(2);
      work.status = WorkStatus.ASSIGNED;
      await manager.save(work);

      application.status = WorkApplicationStatus.SELECTED;
      await manager.save(application);
      await manager.update(
        WorkApplication,
        { workId, status: WorkApplicationStatus.PENDING },
        { status: WorkApplicationStatus.REJECTED },
      );

      return work;
    });
  }

  async submit(projectId: string, workId: string, userId: string) {
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.assigneeId !== userId) throw new ForbiddenException('Not your assignment');
    if (work.status !== WorkStatus.ASSIGNED) throw new ConflictException('Work is not in progress');
    work.status = WorkStatus.SUBMITTED;
    return this.worksRepository.save(work);
  }

  // Founder accepts: the escrow is paid out to the worker. MVP pays cash into
  // the worker's withdrawable balance.
  async accept(projectId: string, workId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.founderId !== userId) throw new ForbiddenException('Not your project');

      const work = await manager.findOne(ProjectWork, {
        where: { id: workId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!work) throw new NotFoundException('Work not found');
      if (work.status !== WorkStatus.SUBMITTED) throw new ConflictException('Work has not been submitted');
      if (!work.assigneeId || work.escrowAmount === null) throw new BadRequestException('Work has no escrow');

      await this.payToWorker(manager, work, parseFloat(work.escrowAmount));

      // Consume the escrow so no other path can pay it again.
      work.escrowAmount = null;
      work.status = WorkStatus.ACCEPTED;
      work.acceptedAt = new Date();
      return manager.save(work);
    });
  }

  // Cancel/refund path (used by dispute resolution too): escrow goes back to the
  // project's spendable balance and the work reopens.
  async cancel(projectId: string, workId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.founderId !== userId) throw new ForbiddenException('Not your project');

      const work = await manager.findOne(ProjectWork, { where: { id: workId, projectId } });
      if (!work) throw new NotFoundException('Work not found');
      if (work.status === WorkStatus.ACCEPTED) throw new ConflictException('An accepted work cannot be cancelled');

      if (work.escrowAmount !== null) {
        project.spendableBalance = (parseFloat(project.spendableBalance) + parseFloat(work.escrowAmount)).toFixed(2);
        await manager.save(project);
      }
      work.status = WorkStatus.CANCELLED;
      work.escrowAmount = null;
      return manager.save(work);
    });
  }

  listMine(userId: string) {
    return this.worksRepository.find({
      where: { assigneeId: userId },
      relations: { project: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Portfolio: a user's accepted works, average rating, and the total count.
  async userWorks(userId: string) {
    const works = await this.worksRepository.find({
      where: { assigneeId: userId, status: WorkStatus.ACCEPTED },
      relations: { project: true },
      order: { acceptedAt: 'DESC' },
    });
    const reviews = await this.reviewsRepository.find({ where: { revieweeId: userId } });
    const averageRating =
      reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
    return {
      completedCount: works.length,
      averageRating,
      reviewsCount: reviews.length,
      items: works.map((w) => ({
        id: w.id,
        projectId: w.projectId,
        projectTitle: w.project?.title ?? {},
        title: w.title,
        price: parseFloat(w.price),
        acceptedAt: w.acceptedAt,
      })),
    };
  }

  // --- Ratings ---

  async reviewWork(projectId: string, workId: string, userId: string, rating: number, comment?: string) {
    await this.assertFounder(projectId, userId);
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.status !== WorkStatus.ACCEPTED || !work.assigneeId) {
      throw new ConflictException('Only an accepted work can be rated');
    }
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1–5');
    const existing = await this.reviewsRepository.findOne({ where: { workId } });
    if (existing) throw new ConflictException('This work is already rated');
    const review = this.reviewsRepository.create({
      workId,
      revieweeId: work.assigneeId,
      raterId: userId,
      rating,
      comment: comment ?? null,
    });
    return this.reviewsRepository.save(review);
  }

  // --- Disputes ---

  // Either the founder or the assignee can flag a dispute on an in-progress work.
  async dispute(projectId: string, workId: string, userId: string) {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (project?.founderId !== userId && work.assigneeId !== userId) {
      throw new ForbiddenException('Only the founder or the worker can dispute');
    }
    if (work.status !== WorkStatus.ASSIGNED && work.status !== WorkStatus.SUBMITTED) {
      throw new ConflictException('This work cannot be disputed');
    }
    work.status = WorkStatus.DISPUTED;
    return this.worksRepository.save(work);
  }

  async listDisputed() {
    const works = await this.worksRepository.find({
      where: { status: WorkStatus.DISPUTED },
      relations: { project: true, assignee: true },
      order: { createdAt: 'ASC' },
    });
    return works.map((w) => ({
      id: w.id,
      projectId: w.projectId,
      projectTitle: w.project?.title ?? {},
      title: w.title,
      brief: w.brief,
      escrowAmount: w.escrowAmount === null ? null : parseFloat(w.escrowAmount),
      assigneeId: w.assigneeId,
      assigneeName: w.assignee?.fullName || w.assignee?.username || null,
    }));
  }

  // Moderator resolves: pay the worker or refund the project's spendable balance.
  async resolveDispute(workId: string, releaseToWorker: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const work = await manager.findOne(ProjectWork, {
        where: { id: workId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!work) throw new NotFoundException('Work not found');
      if (work.status !== WorkStatus.DISPUTED) throw new ConflictException('Work is not in dispute');
      const escrow = work.escrowAmount === null ? 0 : parseFloat(work.escrowAmount);

      if (releaseToWorker) {
        if (escrow > 0) await this.payToWorker(manager, work, escrow);
        work.status = WorkStatus.ACCEPTED;
        work.acceptedAt = new Date();
      } else {
        if (escrow > 0) {
          const project = await manager.findOne(Project, { where: { id: work.projectId } });
          if (project) {
            project.spendableBalance = (parseFloat(project.spendableBalance) + escrow).toFixed(2);
            await manager.save(project);
          }
        }
        work.status = WorkStatus.CANCELLED;
      }
      // Escrow is consumed either way — never payable again.
      work.escrowAmount = null;
      return manager.save(work);
    });
  }

  // --- Milestones ---

  getMilestones(workId: string) {
    return this.milestonesRepository.find({ where: { workId }, order: { order: 'ASC' } });
  }

  async addMilestones(projectId: string, workId: string, userId: string, items: Array<{ title: string; amount: number }>) {
    await this.assertFounder(projectId, userId);
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.status !== WorkStatus.OPEN) throw new ConflictException('Milestones can only be set on an open work');
    await this.milestonesRepository.delete({ workId });
    const saved = await this.milestonesRepository.save(
      items.map((item, i) =>
        this.milestonesRepository.create({ workId, title: item.title, amount: item.amount.toFixed(2), order: i }),
      ),
    );
    // The work price mirrors the sum of its milestones.
    work.price = items.reduce((sum, item) => sum + item.amount, 0).toFixed(2);
    await this.worksRepository.save(work);
    return saved;
  }

  async submitMilestone(projectId: string, workId: string, milestoneId: string, userId: string) {
    const work = await this.worksRepository.findOne({ where: { id: workId, projectId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.assigneeId !== userId) throw new ForbiddenException('Not your assignment');
    const milestone = await this.milestonesRepository.findOne({ where: { id: milestoneId, workId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.status !== MilestoneStatus.PENDING) throw new ConflictException('Milestone is not pending');
    milestone.status = MilestoneStatus.SUBMITTED;
    return this.milestonesRepository.save(milestone);
  }

  // Founder accepts a milestone: its amount is paid from the work escrow. When
  // the last milestone is accepted, the whole work is accepted.
  async acceptMilestone(projectId: string, workId: string, milestoneId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.founderId !== userId) throw new ForbiddenException('Not your project');

      const work = await manager.findOne(ProjectWork, {
        where: { id: workId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!work || !work.assigneeId || work.escrowAmount === null) throw new NotFoundException('Work not found');
      const milestone = await manager.findOne(WorkMilestone, { where: { id: milestoneId, workId } });
      if (!milestone) throw new NotFoundException('Milestone not found');
      if (milestone.status !== MilestoneStatus.SUBMITTED) throw new ConflictException('Milestone is not submitted');

      const amount = parseFloat(milestone.amount);
      await this.payToWorker(manager, work, amount);
      work.escrowAmount = Math.max(0, parseFloat(work.escrowAmount) - amount).toFixed(2);

      milestone.status = MilestoneStatus.ACCEPTED;
      await manager.save(milestone);

      const remaining = await manager.count(WorkMilestone, {
        where: { workId, status: MilestoneStatus.ACCEPTED },
      });
      const total = await manager.count(WorkMilestone, { where: { workId } });
      if (remaining >= total) {
        work.status = WorkStatus.ACCEPTED;
        work.acceptedAt = new Date();
      }
      await manager.save(work);
      return milestone;
    });
  }
}
