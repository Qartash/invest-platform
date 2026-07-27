import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectReviewLog } from './entities/project-review-log.entity';
import { ProjectAttachment } from './entities/project-attachment.entity';
import { ProjectBudgetItem } from './entities/project-budget-item.entity';
import { ProjectTeamMember } from './entities/project-team-member.entity';
import { BudgetItemInputDto, CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { TeamMemberInputDto } from './dto/set-team-members.dto';
import { SetRiskDto } from './dto/set-risk.dto';
import { SetPriorityDto } from './dto/set-priority.dto';
import { BudgetItemStatus, ProjectPriority, ProjectReviewAction, ProjectStatus, UserRole } from '../common/enums';
import { deriveBaseTicketPrice } from './pricing';

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
    @InjectRepository(ProjectTeamMember)
    private readonly teamMembersRepository: Repository<ProjectTeamMember>,
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

  // The moderation queue holds two different things, and they are not the same
  // question. A project *in* PENDING_REVIEW has never been live and is waiting for
  // the gate that lets it out. A live project with `pendingChanges` is already out
  // — it keeps running, keeps selling, keeps its own status — and only an edit to
  // it is waiting. Both belong in the queue; only the first is a status.
  findPendingReview(): Promise<Project[]> {
    return this.projectsRepository.find({
      where: [
        { status: ProjectStatus.PENDING_REVIEW, deletedAt: IsNull() },
        { pendingChanges: Not(IsNull()), deletedAt: IsNull() },
      ],
      relations: { founder: true },
      order: { createdAt: 'DESC' },
    });
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
    const priceTierCount = dto.priceTierCount ?? 4;
    const priceTierIncrementPercent = dto.priceTierIncrementPercent ?? 20;
    const project = this.projectsRepository.create({
      founderId,
      title: dto.title,
      description: dto.description,
      targetAmount: dto.targetAmount.toFixed(2),
      // Derived, not dto.ticketPrice: see deriveBaseTicketPrice for why a caller-supplied
      // price can't be trusted to keep a sell-out equal to the funding goal.
      ticketPrice: deriveBaseTicketPrice({
        targetAmount: dto.targetAmount,
        totalTickets: dto.totalTickets,
        priceTierCount,
        incrementPercent: priceTierIncrementPercent,
      }).toFixed(2),
      totalTickets: dto.totalTickets,
      category: dto.category,
      riskLevel: dto.riskLevel,
      priority: (dto.priority as ProjectPriority) ?? ProjectPriority.MEDIUM,
      coverImageUrl: dto.coverImageUrl,
      deadline: dto.deadline ?? null,
      priceTierCount,
      priceTierIncrementPercent: priceTierIncrementPercent.toFixed(2),
      equityOfferedPercent: (dto.equityOfferedPercent ?? 100).toFixed(2),
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

  listTeamMembers(projectId: string): Promise<ProjectTeamMember[]> {
    return this.teamMembersRepository.find({ where: { projectId }, order: { order: 'ASC' } });
  }

  /**
   * Replaces the whole roster. The founder edits the team as a list — adding, removing and
   * reordering — so a diff-based API would only make both sides reconstruct the same thing.
   * Rows are keyed by position, which is also what `order` means to the reader.
   */
  async setTeamMembers(
    projectId: string,
    founderId: string,
    userRole: UserRole,
    members: TeamMemberInputDto[],
  ): Promise<ProjectTeamMember[]> {
    const project = await this.findOne(projectId);
    if (project.founderId !== founderId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    const valid = members.filter((member) => member.name?.trim() && member.role?.trim());

    await this.teamMembersRepository.delete({ projectId });
    if (valid.length === 0) return [];

    const created = valid.map((member, index) =>
      this.teamMembersRepository.create({
        projectId,
        name: member.name.trim(),
        role: member.role.trim(),
        bio: member.bio?.trim() || null,
        photoUrl: member.photoUrl ?? null,
        order: index,
      }),
    );
    return this.teamMembersRepository.save(created);
  }

  /** Ownership gate for the standalone team-photo upload, which writes no rows itself. */
  async assertCanEditTeam(projectId: string, userId: string, userRole: UserRole): Promise<void> {
    const project = await this.findOne(projectId);
    if (project.founderId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
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
    'equityOfferedPercent',
    'youtubeUrl',
    'resaleEnabled',
    'expectedAnnualReturnPercent',
    'payoutStartDays',
  ] as const;

  // Editing any of these moves the round-1 price with them.
  private static readonly PRICE_INPUT_FIELDS = [
    'targetAmount',
    'totalTickets',
    'priceTierCount',
    'priceTierIncrementPercent',
  ] as const;

  // Everything an investor's stake is priced off. `equityOfferedPercent` is not a
  // price input — it does not move ticketPrice — but it decides what fraction of
  // the company a ticket carries, so it belongs to the same promise.
  //
  // `ticketPrice` is here even though no DTO can set it. normalizeEdit re-derives
  // it whenever a price field is *present*, not only when it changed, so a form
  // that submits every field re-derives against a stored price that may have
  // drifted — that is what src/repair-ticket-prices.ts exists to clean up. Without
  // this entry such a reprice would arrive as a lone `ticketPrice` change and walk
  // straight past a guard watching only the inputs.
  private static readonly STAKE_FIELDS = [
    ...ProjectsService.PRICE_INPUT_FIELDS,
    'equityOfferedPercent',
    'ticketPrice',
  ] as const;

  /**
   * Decides whether a set of already-normalized changes may be applied to this
   * project as it stands right now.
   *
   * Two tiers, because they answer different questions.
   *
   * The hard invariants are arithmetic: fewer tickets than have been sold, or a
   * goal below what has already been collected, describe a project that cannot
   * exist. Nobody may write one — not the founder, not a moderator — because
   * every number downstream is computed off these two. `ticketsLeft` goes
   * negative on the card, dividends in project-finance.service divide by a ticket
   * count that no longer matches the ticket rows, and refunds in
   * project-funding.service pay against a goal smaller than the escrow.
   *
   * The stake policy is a promise: once anyone has bought in, the price and the
   * share a ticket carries are part of what they paid for, and the founder cannot
   * redraw them. This is the rule that already existed for equityOfferedPercent,
   * now covering the three price inputs that reach the same outcome by another
   * route — dropping totalTickets from 100 to 50 doubles every holder's share
   * just as surely as editing the percentage would.
   *
   * A moderator keeps the escape hatch adminUpdate always was: `enforceStakePolicy`
   * off means only the arithmetic is checked, so a genuinely mispriced project can
   * still be repaired by hand. The invariants stay on for them regardless.
   *
   * Called from all three write paths. `approve` matters most: an edit that was
   * valid when the founder sent it can go stale while it waits, because tickets
   * keep selling — so the question has to be asked at the moment of applying, not
   * only at the moment of proposing.
   */
  private assertChangesApplicable(
    project: Project,
    changes: Record<string, any>,
    { enforceStakePolicy }: { enforceStakePolicy: boolean },
  ): void {
    if (project.ticketsSold <= 0) return;

    if (changes.totalTickets !== undefined && Number(changes.totalTickets) < project.ticketsSold) {
      throw new BadRequestException(
        `Cannot set the ticket count below the ${project.ticketsSold} already sold.`,
      );
    }
    if (
      changes.targetAmount !== undefined &&
      parseFloat(changes.targetAmount) < parseFloat(project.collectedAmount)
    ) {
      throw new BadRequestException('Cannot set the goal below the amount already collected.');
    }

    if (!enforceStakePolicy) return;

    const touched = ProjectsService.STAKE_FIELDS.filter((field) => changes[field] !== undefined);
    if (touched.length > 0) {
      throw new BadRequestException(
        'Cannot change the pricing or the offered equity share after tickets have been sold.',
      );
    }
  }

  /**
   * Turns an edit DTO into the column values it implies, shared by the founder and
   * moderator edit paths so the two can't normalize differently.
   *
   * ticketPrice is never taken from the DTO. It's a function of the goal, ticket count
   * and round settings, so it's re-derived from the merged project+DTO values whenever
   * one of those moves, and left untouched otherwise. Deriving from the merge matters:
   * an edit that only sends targetAmount still has to price against the project's
   * existing ticket count.
   */
  private normalizeEdit(project: Project, dto: UpdateProjectDto): Record<string, any> {
    const normalized: Record<string, any> = { ...dto };
    if (dto.targetAmount !== undefined) normalized.targetAmount = dto.targetAmount.toFixed(2);
    if (dto.expectedAnnualReturnPercent !== undefined) {
      normalized.expectedAnnualReturnPercent = dto.expectedAnnualReturnPercent.toFixed(2);
    }
    if (dto.priceTierIncrementPercent !== undefined) {
      normalized.priceTierIncrementPercent = dto.priceTierIncrementPercent.toFixed(2);
    }
    if (dto.equityOfferedPercent !== undefined) {
      normalized.equityOfferedPercent = dto.equityOfferedPercent.toFixed(2);
    }
    if (dto.deadline !== undefined) normalized.deadline = dto.deadline;

    const touchesPrice = ProjectsService.PRICE_INPUT_FIELDS.some((field) => dto[field] !== undefined);
    if (touchesPrice) {
      normalized.ticketPrice = deriveBaseTicketPrice({
        targetAmount: dto.targetAmount ?? parseFloat(project.targetAmount),
        totalTickets: dto.totalTickets ?? project.totalTickets,
        priceTierCount: dto.priceTierCount ?? project.priceTierCount,
        incrementPercent: dto.priceTierIncrementPercent ?? parseFloat(project.priceTierIncrementPercent),
      }).toFixed(2);
    } else {
      delete normalized.ticketPrice;
    }

    return normalized;
  }

  async update(id: string, founderId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    // One edit in flight at a time, whichever shape the wait takes: a project
    // sitting in PENDING_REVIEW, or a live one carrying pendingChanges.
    if (project.status === ProjectStatus.PENDING_REVIEW || project.pendingChanges) {
      throw new BadRequestException(
        'This project already has changes pending review. Wait for the moderator to approve or reject it first.',
      );
    }
    if (project.deletedAt || project.deletionRequestedAt) {
      throw new BadRequestException('Cannot edit a project that is deleted or pending deletion.');
    }
    const normalized = this.normalizeEdit(project, dto);

    const changes: Record<string, any> = {};
    for (const field of ProjectsService.EDITABLE_FIELDS) {
      if (normalized[field] === undefined) continue;
      const currentValue = (project as any)[field];
      if (JSON.stringify(currentValue ?? null) !== JSON.stringify(normalized[field] ?? null)) {
        changes[field] = normalized[field];
      }
    }

    // Checked against the diff rather than the DTO, so re-sending a field at its
    // current value is not an edit and does not trip the policy.
    this.assertChangesApplicable(project, changes, { enforceStakePolicy: true });

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
    // A live project keeps its status while its edit waits. It used to drop to
    // PENDING_REVIEW and be restored afterwards from statusBeforeReview, which was
    // worst on a funded one: the raise is over, there is nothing left to pause, and
    // yet a typo fix parked 5 000 000 ֏ of finished project two rungs down the
    // ladder, in the queue beside unreviewed drafts. A project that has never been
    // live still goes to PENDING_REVIEW below — for it the review is the gate, not
    // an interruption.
    if (project.status === ProjectStatus.DRAFT || project.status === ProjectStatus.REJECTED) {
      project.status = ProjectStatus.PENDING_REVIEW;
    }
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.SUBMITTED, { changes, comment: project.pendingChangeReason });
    return saved;
  }

  // Admin edits skip the pending-changes moderation loop entirely: the moderator
  // is the one making the change, so it applies to the live project immediately
  // and is recorded in the review history as its own action.
  async adminUpdate(id: string, dto: UpdateProjectDto, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted project. Restore it first.');
    }

    const normalized = this.normalizeEdit(project, dto);

    const changes: Record<string, any> = {};
    for (const field of ProjectsService.EDITABLE_FIELDS) {
      if (normalized[field] === undefined) continue;
      const currentValue = (project as any)[field];
      if (JSON.stringify(currentValue ?? null) !== JSON.stringify(normalized[field] ?? null)) {
        changes[field] = normalized[field];
      }
    }

    // The moderator is trusted to reprice a project the founder no longer may —
    // that is what this path is for — but not to write a state that cannot exist.
    this.assertChangesApplicable(project, changes, { enforceStakePolicy: false });

    if (Object.keys(changes).length === 0) {
      return project;
    }

    Object.assign(project, changes);
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.ADMIN_EDITED, {
      changes,
      moderatorId,
      moderatorName,
    });
    return saved;
  }

  async cancelReview(id: string, founderId: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId) {
      throw new ForbiddenException('Not your project');
    }
    if (project.status !== ProjectStatus.PENDING_REVIEW && !project.pendingChanges) {
      throw new BadRequestException('This project is not currently pending review');
    }
    // Withdraw the request. A live project never left its status, so there is
    // nothing to restore — dropping the proposed changes is the whole undo. Only a
    // project that went *into* PENDING_REVIEW has to come back out, and it came
    // from draft.
    if (project.status === ProjectStatus.PENDING_REVIEW) {
      project.status = ProjectStatus.DRAFT;
    }
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

    if (project.ticketsSold > 0 || ProjectsService.heldFunds(project) > 0) {
      // Investors already hold tickets in this project, or it is still holding money — a
      // moderator must sign off before it disappears from view.
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

  // How much of investors' and the project's money is still sitting in a project. Deleting it
  // while this is non-zero strands the money: the row keeps the balances but drops out of every
  // listing, so nobody can reach it again.
  private static heldFunds(project: Project): number {
    return parseFloat(project.treasuryBalance) + parseFloat(project.spendableBalance);
  }

  async approveDeletion(id: string, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    if (!project.deletionRequestedAt) {
      throw new BadRequestException('There is no pending deletion request for this project');
    }
    // Refuse rather than silently refunding: paying money back to investors is a decision a
    // moderator should make deliberately, via the refund endpoint, not a side effect of
    // approving a deletion. Refunding first also closes the project, so the order is natural.
    if (ProjectsService.heldFunds(project) > 0) {
      throw new ConflictException(
        'This project still holds investor funds — refund it before approving the deletion',
      );
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

  async setCoverImage(id: string, founderId: string, coverImageUrl: string, userRole?: UserRole): Promise<Project> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    project.coverImageUrl = coverImageUrl;
    return this.projectsRepository.save(project);
  }

  async addAttachment(
    id: string,
    founderId: string,
    file: { fileName: string; fileUrl: string; fileSize: number; mimeType: string | null },
    userRole?: UserRole,
  ): Promise<ProjectAttachment> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId && userRole !== UserRole.ADMIN) {
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

  async deleteAttachment(id: string, attachmentId: string, founderId: string, userRole?: UserRole): Promise<void> {
    const project = await this.findOne(id);
    if (project.founderId !== founderId && userRole !== UserRole.ADMIN) {
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
      // Time passed while this waited, and tickets kept selling. An edit that was
      // valid when it was proposed can be invalid by now, so it is judged against
      // the project as it stands, under the same policy the founder was held to.
      // Refusing here leaves the request in the queue for the moderator to reject
      // with a reason, which is the honest outcome — silently dropping the offending
      // fields would tell the founder their edit went through.
      this.assertChangesApplicable(project, project.pendingChanges, { enforceStakePolicy: true });
      Object.assign(project, project.pendingChanges);
    }
    // Only a project waiting at the gate changes status on approval. A live one
    // was never moved, so approving its edit must leave FUNDED as FUNDED — the old
    // code sent it to statusBeforeReview, and to ACTIVE if that had been lost.
    if (project.status === ProjectStatus.PENDING_REVIEW) {
      project.status = ProjectStatus.ACTIVE;
    }
    project.pendingChanges = null;
    project.pendingChangeReason = null;
    project.reviewComment = comment;
    const saved = await this.projectsRepository.save(project);
    await this.logReview(saved.id, ProjectReviewAction.APPROVED, { comment, moderatorId, moderatorName });
    return saved;
  }

  async reject(id: string, comment: string, moderatorId: string, moderatorName: string): Promise<Project> {
    const project = await this.findOne(id);
    // Rejecting an edit to a live project discards the proposal and nothing else:
    // the project is still live, still selling, and REJECTED would be a verdict on
    // the project rather than on the edit. Only a project that has never passed the
    // gate is rejected as such.
    if (project.status === ProjectStatus.PENDING_REVIEW) {
      project.status = ProjectStatus.REJECTED;
    }
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
