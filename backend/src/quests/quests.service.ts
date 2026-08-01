import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Quest } from './entities/quest.entity';
import { QuestCompletion } from './entities/quest-completion.entity';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Project } from '../projects/entities/project.entity';
import { RewardsService } from '../activity/rewards.service';
import { QuestScope, QuestVerification, UserRole } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-types';

// The quests every account gets, seeded once. Keys are what the app translates,
// so the wording lives in the locale files rather than in the database.
const PLATFORM_QUESTS: Array<Pick<Quest, 'key' | 'verification' | 'rule' | 'reward'>> = [
  { key: 'profile_complete', verification: QuestVerification.AUTO, rule: 'profile_complete', reward: '30.00' },
  { key: 'first_investment', verification: QuestVerification.AUTO, rule: 'first_investment', reward: '100.00' },
  { key: 'bug_report', verification: QuestVerification.ADMIN, rule: null, reward: '100.00' },
];

@Injectable()
export class QuestsService implements OnModuleInit {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    @InjectRepository(Quest)
    private readonly questsRepository: Repository<Quest>,
    @InjectRepository(QuestCompletion)
    private readonly completionsRepository: Repository<QuestCompletion>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly rewardsService: RewardsService,
    private readonly notifications: NotificationsService,
  ) {}

  // Idempotent: only keys that aren't there yet are inserted, so a redeploy adds
  // new built-ins without disturbing the rewards already earned on the old ones.
  async onModuleInit(): Promise<void> {
    const existing = await this.questsRepository.find({
      where: { key: In(PLATFORM_QUESTS.map((q) => q.key!)) },
      select: { key: true },
    });
    const have = new Set(existing.map((q) => q.key));
    const missing = PLATFORM_QUESTS.filter((q) => !have.has(q.key));
    if (missing.length === 0) return;
    await this.questsRepository.save(
      missing.map((q) => this.questsRepository.create({ ...q, scope: QuestScope.PLATFORM })),
    );
    this.logger.log(`Seeded ${missing.length} platform quest(s)`);
  }

  // Everything on offer, with this user's state folded in: what they've done, and
  // for the auto-checked ones whether the condition is satisfied right now.
  async listFor(userId: string) {
    const quests = await this.questsRepository.find({
      where: [
        { active: true, scope: QuestScope.PLATFORM },
        { active: true, scope: QuestScope.PROJECT },
      ],
      order: { createdAt: 'ASC' },
    });
    const completions = await this.completionsRepository.find({ where: { userId } });
    const doneBy = new Map(completions.map((c) => [c.questId, c]));

    const projectIds = [...new Set(quests.map((q) => q.projectId).filter((id): id is string => !!id))];
    const projects = projectIds.length
      ? await this.projectsRepository.find({ where: { id: In(projectIds) } })
      : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));

    return Promise.all(
      quests.map(async (q) => {
        const done = doneBy.get(q.id);
        return {
          id: q.id,
          key: q.key,
          scope: q.scope,
          verification: q.verification,
          title: q.title,
          description: q.description,
          videoUrl: q.videoUrl,
          reward: Number(q.reward),
          projectId: q.projectId,
          projectTitle: q.projectId ? (projectById.get(q.projectId)?.title ?? null) : null,
          completed: !!done,
          completedAmount: done ? Number(done.amount) : 0,
          // Only meaningful for auto quests; the client uses it to show whether
          // the button is worth pressing yet.
          eligible: done ? false : q.verification === QuestVerification.AUTO ? await this.checkRule(q.rule, userId) : true,
        };
      }),
    );
  }

  // The user finishing a quest themselves. Admin-verified quests refuse here —
  // that is the whole point of them.
  async complete(userId: string, questId: string) {
    const quest = await this.questsRepository.findOne({ where: { id: questId, active: true } });
    if (!quest) throw new NotFoundException('Quest not found');
    if (quest.verification === QuestVerification.ADMIN) {
      throw new ForbiddenException('This quest is confirmed by a moderator');
    }
    if (quest.verification === QuestVerification.AUTO && !(await this.checkRule(quest.rule, userId))) {
      throw new BadRequestException('Quest conditions are not met yet');
    }
    return this.payOnce(userId, quest, Number(quest.reward));
  }

  // A moderator confirming an admin-verified quest for someone, optionally for
  // less than the headline figure (a small bug earns a small bounty).
  async completeAsAdmin(userId: string, questId: string, amount?: number) {
    const quest = await this.questsRepository.findOne({ where: { id: questId } });
    if (!quest) throw new NotFoundException('Quest not found');
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.payOnce(userId, quest, amount ?? Number(quest.reward));
  }

  // Records the completion first, so the unique index — not a check-then-act race
  // — is what stops a second reward; only then is the money moved.
  private async payOnce(userId: string, quest: Quest, amount: number) {
    const already = await this.completionsRepository.findOne({ where: { userId, questId: quest.id } });
    if (already) throw new ConflictException('Quest already completed');

    let completion: QuestCompletion;
    try {
      completion = await this.completionsRepository.save(
        this.completionsRepository.create({ userId, questId: quest.id, amount: '0.00' }),
      );
    } catch {
      // Lost the race against a concurrent identical request.
      throw new ConflictException('Quest already completed');
    }

    const paid = await this.rewardsService.award(userId, amount, quest.key ?? quest.title ?? 'Quest reward');
    completion.amount = paid.toFixed(2);
    await this.completionsRepository.save(completion);
    // Covers both routes into a payout. The self-completed ones the user is
    // watching happen; the admin-verified ones — a bug bounty, say — are decided
    // days later by somebody else, and this is the only word of it they get.
    if (paid > 0) {
      await this.notifications.notify({
        userId,
        type: NotificationType.QUEST_REWARDED,
        payload: { amount: paid, questKey: quest.key, questTitle: quest.title, questId: quest.id },
      });
    }
    return { questId: quest.id, awarded: paid };
  }

  // Server-side proof for the auto quests.
  private async checkRule(rule: string | null, userId: string): Promise<boolean> {
    if (!rule) return false;
    if (rule === 'profile_complete') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) return false;
      return !!(user.fullName && user.phone && user.occupation && user.birthDate);
    }
    if (rule === 'first_investment') {
      const owned = await this.ticketsRepository.count({ where: { ownerId: userId } });
      return owned > 0;
    }
    return false;
  }

  // A founder attaching a paid task to their own project — the "watch our video"
  // case. Paid from the same pool, so the amount is capped to keep it a nudge
  // rather than a channel for moving money around.
  async createProjectQuest(
    actor: User,
    data: { projectId: string; title: string; description?: string; videoUrl?: string; reward: number },
  ) {
    const project = await this.projectsRepository.findOne({ where: { id: data.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.founderId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the founder can add a quest to this project');
    }
    if (data.reward <= 0 || data.reward > QuestsService.MAX_PROJECT_REWARD) {
      throw new BadRequestException(`Reward must be between 1 and ${QuestsService.MAX_PROJECT_REWARD}`);
    }
    const saved = await this.questsRepository.save(
      this.questsRepository.create({
        key: null,
        scope: QuestScope.PROJECT,
        verification: QuestVerification.CLIENT,
        rule: null,
        title: data.title,
        description: data.description ?? null,
        videoUrl: data.videoUrl ?? null,
        reward: data.reward.toFixed(2),
        projectId: data.projectId,
      }),
    );

    // Offered to the project's own investors: they are the people already
    // following it, and a paid task is worth nothing unheard.
    const holders: Array<{ ownerId: string }> = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .select('DISTINCT ticket.owner_id', 'ownerId')
      .where('ticket.project_id = :projectId', { projectId: data.projectId })
      .getRawMany();
    await this.notifications.notifyMany(
      holders
        .filter((holder) => holder.ownerId !== project.founderId)
        .map((holder) => ({
          userId: holder.ownerId,
          type: NotificationType.PROJECT_QUEST_ADDED,
          payload: {
            projectId: project.id,
            projectTitle: project.title,
            questId: saved.id,
            questTitle: saved.title,
            amount: parseFloat(saved.reward),
          },
        })),
    );
    return saved;
  }

  // Small by design: these are payments for attention, not for investing.
  private static readonly MAX_PROJECT_REWARD = 100;

  // Quests a moderator can confirm, with who is still waiting on them.
  async adminPending() {
    const quests = await this.questsRepository.find({
      where: { verification: QuestVerification.ADMIN, active: true },
    });
    return quests.map((q) => ({ id: q.id, key: q.key, title: q.title, reward: Number(q.reward) }));
  }
}
