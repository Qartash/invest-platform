import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectReviewLog } from './entities/project-review-log.entity';
import { ProjectAttachment } from './entities/project-attachment.entity';
import { ProjectBudgetItem } from './entities/project-budget-item.entity';
import { BudgetItemInputDto, CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SetRiskDto } from './dto/set-risk.dto';
import { SetPriorityDto } from './dto/set-priority.dto';
import { BudgetItemStatus, ProjectPriority, ProjectReviewAction, ProjectStatus, UserRole } from '../common/enums';

const MAX_ATTACHMENTS_PER_PROJECT = 10;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectReviewLog)
    private readonly reviewLogsRepository: Repository<ProjectReviewLog>,
    @InjectRepository(ProjectAttachment)
    private readonly attachmentsRepository: Repository<ProjectAttachment>,
    @InjectRepository(ProjectBudgetItem)
    private readonly budgetItemsRepository: Repository<ProjectBudgetItem>,
  ) {}

  private logReview(
    projectId: string,
    action: ProjectReviewAction,
    opts: { comment?: string | null; moderatorId?: string | null; moderatorName?: string | null; changes?: Record<string, any> | null } = {},
  ): Promise<ProjectReviewLog> {
    const log = this.reviewLogsRepository.create({
      projectId,
      action,
      comment: opts.comment ?? null,
      moderatorId: opts.moderatorId ?? null,
      moderatorName: opts.moderatorName ?? null,
      changes: opts.changes ?? null,
    });
    return this.reviewLogsRepository.save(log);
  }

  async getHistory(id: string): Promise<ProjectReviewLog[]> {
    return this.reviewLogsRepository.find({
      where: { projectId: id },
      order: { createdAt: 'ASC' },
    });
  }

  findByStatus(status: ProjectStatus): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { status, deletedAt: IsNull() },
      relations: { founder: true },
      order: { createdAt: 'DESC' },
    });
  }

  findActive(): Promise<Project[]> {
    return this.findByStatus(ProjectStatus.ACTIVE);
  }

  findPendingReview(): Promise<Project[]> {
    return this.findByStatus(ProjectStatus.PENDING_REVIEW);
  }

  findPendingDeletions(): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { deletionRequestedAt: Not(IsNull()) },
      relations: { founder: true },
      order: { deletionRequestedAt: 'ASC' },
    });
  }

  // Moderation overview: every project regardless of status, deleted ones included.
  findAllForModeration(): Promise<Project[]> {
    return this.projectsRepository.find({
      relations: { founder: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id }, relations: { founder: true } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  findByFounder(founderId: string): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { founderId },
      relations: { founder: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(founderId: string, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectsRepository.create({
      founderId,
      title: dto.title,
      description: dto.description,
      targetAmount: dto.targetAmount.toFixed(2),
      ticketPrice: dto.ticketPrice.toFixed(2),
      totalTickets: dto.totalTickets,
      category: dto.category,
      riskLevel: dto.riskLevel,
      priority: (dto.priority as ProjectPriority) ?? ProjectPriority.MEDIUM,
      coverImageUrl: dto.coverImageUrl,
      deadline: dto.deadline ?? null,
      priceTierCount: dto.priceTierCount ?? 4,
      priceTierIncrementPercent: (dto.priceTierIncrementPercent ?? 20).toFixed(2),
      youtubeUrl: dto.youtubeUrl ?? null,
      resaleEnabled: dto.resaleEnabled ?? false,
      expectedAnnualReturnPercent: (dto.expectedAnnualReturnPercent ?? 20).toFixed(2),
      payoutStartDays: dto.payoutStartDays ?? 30,
      status: ProjectStatus.PENDING_REVIEW,
    });
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.SUBMITTED);
    if (dto.budgetItems && dto.budgetItems.length > 0) {
      const items = dto.budgetItems
        .filter((item) => item.title?.trim() && item.amount > 0)
        .map((item, index) =>
          this.budgetItemsRepository.create({
            projectId: saved.id,
            title: item.title.trim(),
            amount: item.amount.toFixed(2),
            order: index,
          }),
        );
      if (items.length > 0) {
        await this.budgetItemsRepository.save(items);
      }
    }
    return saved;
  }

  listBudgetItems(projectId: string): Promise<ProjectBudgetItem[]> {
    return this.budgetItemsRepository.find({ where: { projectId }, order: { order: 'ASC' } });
  }

  async addBudgetItems(
    projectId: string,
    founderId: string,
    userRole: UserRole,
    items: BudgetItemInputDto[],
  ): Promise<ProjectBudgetItem[]> {
    const project = await this.findOne(projectId);
    if (project.founderId !== founderId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    const existingCount = await this.budgetItemsRepository.count({ where: { projectId } });
    const valid = items.filter((item) => item.title?.trim() && item.amount > 0);
    const created = valid.map((item, index) =>
      this.budgetItemsRepository.create({
        projectId,
        title: item.title.trim(),
        amount: item.amount.toFixed(2),
        order: existingCount + index,
      }),
    );
    return this.budgetItemsRepository.save(created);
  }

  async updateBudgetItemStatus(
    projectId: string,
    itemId: string,
    founderId: string,
    userRole: UserRole,
    status: BudgetItemStatus,
  ): Promise<ProjectBudgetItem> {
    const project = await this.findOne(projectId);
    if (project.founderId !== founderId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    const item = await this.budgetItemsRepository.findOne({ where: { id: itemId, projectId } });
    if (!item) {
      throw new NotFoundException('Budget item not found');
    }
    item.status = status;
    return this.budgetItemsRepository.save(item);
  }

  private static readonly EDITABLE_FIELDS = [
    'title',
    'description',
    'targetAmount',
    'ticketPrice',
    'totalTickets',
    'category',
    'deadline',
    'priceTierCount',
    'priceTierIncrementPercent',
    'youtubeUrl',
    'resaleEnabled',
    'expectedAnnualReturnPercent',
    'payoutStartDays',
  ] as const;

  async update(id: string, founderId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    if (project.status === ProjectStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'This project already has changes pending review. Wait for the moderator to approve or reject it first.',
      );
    }
    if (project.deletedAt || project.deletionRequestedAt) {
      throw new BadRequestException('Cannot edit a project that is deleted or pending deletion.');
    }

    const normalized: Record<string, any> = { ...dto };
    if (dto.targetAmount !== undefined) normalized.targetAmount = dto.targetAmount.toFixed(2);
    if (dto.ticketPrice !== undefined) normalized.ticketPrice = dto.ticketPrice.toFixed(2);
    if (dto.expectedAnnualReturnPercent !== undefined) {
      normalized.expectedAnnualReturnPercent = dto.expectedAnnualReturnPercent.toFixed(2);
    }
    if (dto.priceTierIncrementPercent !== undefined) {
      normalized.priceTierIncrementPercent = dto.priceTierIncrementPercent.toFixed(2);
    }
    if (dto.deadline !== undefined) normalized.deadline = dto.deadline;

    const changes: Record<string, any> = {};
    for (const field of ProjectsService.EDITABLE_FIELDS) {
      if (normalized[field] === undefined) continue;
      const currentValue = (project as any)[field];
      if (JSON.stringify(currentValue ?? null) !== JSON.stringify(normalized[field] ?? null)) {
        changes[field] = normalized[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      if (project.status === ProjectStatus.REJECTED || project.status === ProjectStatus.DRAFT) {
        // Nothing textual changed, but the founder still wants another look
        // (e.g. they addressed the moderator's concern outside the form).
        project.status = ProjectStatus.PENDING_REVIEW;
        project.pendingChangeReason = dto.changeReason?.trim() || null;
        const saved = await this.projectsRepository.save(project);
        await this.logReview(saved.id, ProjectReviewAction.SUBMITTED, { comment: project.pendingChangeReason });
        return saved;
      }
      return project;
    }

    project.pendingChanges = changes;
    project.pendingChangeReason = dto.changeReason?.trim() || null;
    project.statusBeforeReview =
      project.status === ProjectStatus.ACTIVE || project.status === ProjectStatus.FUNDED ? project.status : null;
    project.status = ProjectStatus.PENDING_REVIEW;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.SUBMITTED, { changes, comment: project.pendingChangeReason });
    return saved;
  }

  async cancelReview(id: string, founderId: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    if (project.status !== ProjectStatus.PENDING_REVIEW) {
      throw new BadRequestException('This project is not currently pending review');
    }
    // Withdraw the request: an edit-in-progress project goes back to how it was live;
    // a project that has never been reviewed yet goes back to draft.
    project.status = project.statusBeforeReview ?? ProjectStatus.DRAFT;
    project.statusBeforeReview = null;
    project.pendingChanges = null;
    project.pendingChangeReason = null;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.CANCELLED);
    return saved;
  }

  private static readonly RESTORE_WINDOW_DAYS = 7;

  async requestDeletion(id: string, founderId: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    if (project.deletedAt) {
      throw new BadRequestException('Project is already deleted');
    }
    if (project.deletionRequestedAt) {
      throw new BadRequestException('Deletion is already pending moderator approval');
    }

    if (project.ticketsSold > 0) {
      // Investors already hold tickets in this project — a moderator must sign off
      // before it disappears from view.
      project.deletionRequestedAt = new Date();
      const saved = await this.projectsRepository.save(project);
      await this.logReview(saved.id, ProjectReviewAction.DELETION_REQUESTED);
      return saved;
    }

    project.deletedAt = new Date();
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.DELETED);
    return saved;
  }

  async cancelDeletionRequest(id: string, founderId: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    if (!project.deletionRequestedAt) {
      throw new BadRequestException('There is no pending deletion request for this project');
    }
    project.deletionRequestedAt = null;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.CANCELLED);
    return saved;
  }

  async approveDeletion(id: string, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    if (!project.deletionRequestedAt) {
      throw new BadRequestException('There is no pending deletion request for this project');
    }
    project.deletionRequestedAt = null;
    project.deletedAt = new Date();
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.DELETION_APPROVED, { moderatorId, moderatorName });
    return saved;
  }

  async rejectDeletion(id: string, comment: string, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    if (!project.deletionRequestedAt) {
      throw new BadRequestException('There is no pending deletion request for this project');
    }
    project.deletionRequestedAt = null;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.DELETION_REJECTED, { comment, moderatorId, moderatorName });
    return saved;
  }

  async restoreProject(id: string, founderId: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    if (!project.deletedAt) {
      throw new BadRequestException('Project is not deleted');
    }
    const daysSinceDeletion = (Date.now() - project.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeletion > ProjectsService.RESTORE_WINDOW_DAYS) {
      throw new BadRequestException('The 7-day restore window has expired');
    }
    project.deletedAt = null;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.RESTORED);
    return saved;
  }

  async setCoverImage(id: string, founderId: string, coverImageUrl: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    project.coverImageUrl = coverImageUrl;
    return this.projectsRepository.save(project);
  }

  async addAttachment(
    id: string,
    founderId: string,
    file: { fileName: string; fileUrl: string; fileSize: number; mimeType: string | null },
  ): Promise<ProjectAttachment> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    const existingCount = await this.attachmentsRepository.count({ where: { projectId: id } });
    if (existingCount >= MAX_ATTACHMENTS_PER_PROJECT) {
      throw new BadRequestException(`Maximum ${MAX_ATTACHMENTS_PER_PROJECT} attachments per project`);
    }
    const attachment = this.attachmentsRepository.create({
      projectId: id,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    });
    return this.attachmentsRepository.save(attachment);
  }

  listAttachments(id: string): Promise<ProjectAttachment[]> {
    return this.attachmentsRepository.find({
      where: { projectId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteAttachment(id: string, attachmentId: string, founderId: string): Promise<void> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    const attachment = await this.attachmentsRepository.findOne({ where: { id: attachmentId, projectId: id } });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    await this.attachmentsRepository.remove(attachment);
  }

  async approve(id: string, comment: string, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.pendingChanges) {
      Object.assign(project, project.pendingChanges);
    }
    project.status = project.statusBeforeReview ?? ProjectStatus.ACTIVE;
    project.statusBeforeReview = null;
    project.pendingChanges = null;
    project.pendingChangeReason = null;
    project.reviewComment = comment;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.APPROVED, { comment, moderatorId, moderatorName });
    return saved;
  }

  async reject(id: string, comment: string, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    // If this was a re-review of an edit to an already-live project, discard the
    // proposed changes and restore it to whatever state it was live in before.
    project.status = project.statusBeforeReview ?? ProjectStatus.REJECTED;
    project.statusBeforeReview = null;
    project.pendingChanges = null;
    project.pendingChangeReason = null;
    project.reviewComment = comment;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.REJECTED, { comment, moderatorId, moderatorName });
    return saved;
  }

  async setRisk(id: string, dto: SetRiskDto, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    project.riskLevel = dto.riskLevel;
    project.riskReason = dto.reason;
    project.riskSetByName = moderatorName;
    project.riskSetByUserId = moderatorId;
    project.riskSetAt = new Date();
    return this.projectsRepository.save(project);
  }

  async setPriority(
    id: string,
    dto: SetPriorityDto,
    user: { id: string; role: UserRole; name: string },
  ): Promise<Project> {
    const project = await this.findOne(id);
    if (user.role !== UserRole.ADMIN && project.founderId !== user.id) {
      throw new ForbiddenException('Not your project');
    }
    const previousPriority = project.priority;
    project.priority = dto.priority as ProjectPriority;
    const saved = await this.projectsRepository.save(project);
    if (previousPriority !== saved.priority) {
      await this.logReview(saved.id, ProjectReviewAction.PRIORITY_CHANGED, {
        moderatorId: user.id,
        moderatorName: user.name,
        changes: { from: previousPriority, to: saved.priority },
      });
    }
    return saved;
  }

  async incrementFunding(id: string, amount: number, ticketsCount: number): Promise<Project> {
    const project = await this.findOne(id);
    project.collectedAmount = (parseFloat(project.collectedAmount) + amount).toFixed(2);
    project.ticketsSold += ticketsCount;
    if (project.ticketsSold >= project.totalTickets) {
      project.status = ProjectStatus.FUNDED;
    }
    return this.projectsRepository.save(project);
  }
}
