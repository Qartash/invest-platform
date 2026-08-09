import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ProjectUpdate } from './entities/project-update.entity';
import { UpdateRead } from './entities/update-read.entity';
import { ProjectQuestion } from './entities/project-question.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { ProjectStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotifyInput } from '../notifications/notification-types';
import { TicketsService } from '../tickets/tickets.service';
import { CreateUpdateDto, EditUpdateDto } from './dto/update.dto';
import { toAuthor } from './presenters';
import { VotesService } from './votes.service';
import { ContentTarget } from '../common/enums';

/**
 * How long a post can be corrected after it goes out. Long enough for the typo
 * you notice on re-reading, short enough that nobody rewrites last month's
 * promise once it has been read by ninety people.
 */
const EDIT_WINDOW_MINUTES = 60;

/**
 * When a live project counts as having gone quiet. A month is roughly the point
 * at which an investor stops assuming the founder is busy and starts assuming
 * they are gone.
 */
const SILENT_AFTER_DAYS = 30;

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(
    @InjectRepository(ProjectUpdate)
    private readonly updatesRepository: Repository<ProjectUpdate>,
    @InjectRepository(UpdateRead)
    private readonly readsRepository: Repository<UpdateRead>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectQuestion)
    private readonly questionsRepository: Repository<ProjectQuestion>,
    private readonly notifications: NotificationsService,
    private readonly tickets: TicketsService,
    private readonly votes: VotesService,
  ) {}

  // ── Posting ────────────────────────────────────────────────────────────────

  async create(user: User, projectId: string, dto: CreateUpdateDto) {
    const project = await this.loadProject(projectId);
    if (project.founderId !== user.id) {
      throw new ForbiddenException('Only the founder posts updates about their project');
    }
    if (project.status === ProjectStatus.DRAFT || project.status === ProjectStatus.PENDING_REVIEW) {
      throw new BadRequestException('This project has no investors to tell yet');
    }

    const post = await this.save(project, user, {
      title: dto.title.trim(),
      body: dto.body.trim(),
      photos: dto.photos ?? null,
    });

    // Off by default would make the feature pointless; off by choice is for the
    // small correction that does not deserve ninety notifications.
    if (dto.notifyHolders !== false) {
      await this.announce(project, post);
    }

    return this.present(post, user);
  }

  /**
   * The answer a founder decided everybody should see, posted as news.
   *
   * Called from the answering flow rather than being a separate action the
   * founder has to remember: the moment they know an answer matters to more than
   * the person who asked is the moment they are writing it.
   */
  async postFromAnswer(
    project: Project,
    founder: User,
    question: ProjectQuestion,
    body: string,
  ): Promise<void> {
    const post = await this.save(project, founder, {
      // The question itself makes the better headline — it is what the reader
      // recognises, and it is already short.
      title: question.body.slice(0, 117) + (question.body.length > 117 ? '…' : ''),
      body,
      photos: null,
      autoPayload: { questionId: question.id, kind: 'answer' },
    });
    await this.announce(project, post);
  }

  /**
   * The post the platform writes itself when a financial report is published.
   *
   * This is what keeps the feed alive on a project whose founder never writes
   * anything: the reporting flow already produces the one piece of news every
   * holder wants, so it announces itself instead of waiting to be summarised by
   * hand. `auto` marks it so the app can render it as figures with a link rather
   * than as prose.
   */
  async postReportPublished(
    projectId: string,
    report: { id: string; periodLabel?: string | null; revenue?: number; dividends?: number; holders?: number },
  ): Promise<void> {
    try {
      const project = await this.projectsRepository.findOne({ where: { id: projectId } });
      if (!project || project.deletedAt) return;

      const post = await this.save(project, null, {
        title: report.periodLabel ? `Financial report · ${report.periodLabel}` : 'Financial report published',
        body: '',
        photos: null,
        auto: true,
        autoPayload: {
          kind: 'financial_report',
          reportId: report.id,
          revenue: report.revenue ?? null,
          dividends: report.dividends ?? null,
          holders: report.holders ?? null,
        },
      });
      // No notification: publishing a report already sends
      // FINANCIAL_REPORT_PUBLISHED to every holder, and a second bell for the
      // same event is how people learn to ignore the first one.
      void post;
    } catch (err) {
      // A feed post must never be the reason a published report fails.
      this.logger.error(`Failed to auto-post report for project ${projectId}`, err as Error);
    }
  }

  /**
   * Corrections, inside the window. Nothing is overwritten silently: `editedAt`
   * is set and the app shows it.
   */
  async edit(user: User, updateId: string, dto: EditUpdateDto) {
    const post = await this.load(updateId);
    if (post.authorId !== user.id) throw new ForbiddenException('Not your post');
    if (post.auto) throw new BadRequestException('An automatic post cannot be edited');

    const age = (Date.now() - post.createdAt.getTime()) / 60000;
    if (age > EDIT_WINDOW_MINUTES) {
      throw new BadRequestException(
        `A post can only be edited within ${EDIT_WINDOW_MINUTES} minutes. Post a new update instead.`,
      );
    }

    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.body !== undefined) post.body = dto.body.trim();
    if (dto.photos !== undefined) post.photos = dto.photos;
    post.editedAt = new Date();
    await this.updatesRepository.save(post);
    return this.present(post, user);
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  async listForProject(projectId: string, viewer: User | null, page = 1, pageSize = 20) {
    const take = Math.min(50, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;

    const [posts, total] = await this.updatesRepository.findAndCount({
      where: { projectId, hiddenAt: IsNull() },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    const myVotes = await this.votes.myVotesFor(
      viewer?.id ?? null,
      posts.map((post) => ({ type: ContentTarget.UPDATE, id: post.id })),
    );

    return {
      items: posts.map((post) => this.present(post, viewer, myVotes)),
      total,
      page: Math.max(1, page),
      pageSize: take,
    };
  }

  /**
   * Records that this person has seen these posts, and keeps `read_count` equal
   * to the number of people who have.
   *
   * Takes a list because a reader opens a feed, not a post: everything rendered
   * on the screen has been seen, and reporting only the newest one left every
   * older post reading zero forever.
   *
   * The insert is what decides whether anything is counted — a second visit by
   * the same person hits the unique index, is ignored, and increments nothing.
   * The counter used to be an increment per request, which made a post on a
   * two-investor project read "by 9" after the founder opened the tab nine
   * times. A number a founder uses to decide whether anyone is listening cannot
   * be inflated by the founder looking at it.
   */
  async markRead(userId: string, updateIds: string[]): Promise<{ counted: number }> {
    if (updateIds.length === 0) return { counted: 0 };

    // The author reading their own post is not a reader. A founder opens their
    // feed far more often than any investor does, and counting that would put
    // the number back where it started — high for reasons that say nothing
    // about whether anyone is listening.
    const mine = await this.updatesRepository.find({
      where: { id: In(updateIds), authorId: userId },
      select: { id: true },
    });
    const own = new Set(mine.map((post) => post.id));
    const readable = updateIds.filter((id) => !own.has(id));
    if (readable.length === 0) return { counted: 0 };

    const inserted = await this.readsRepository
      .createQueryBuilder()
      .insert()
      .into(UpdateRead)
      .values(readable.map((updateId) => ({ updateId, userId })))
      .orIgnore()
      .returning(['updateId'])
      .execute();

    // Only the rows that were new: the ones the index rejected are visits by
    // somebody already counted. The column name comes back in whichever case
    // the driver used, so both are accepted.
    const firstTime = ((inserted.raw as Array<{ update_id?: string; updateId?: string }>) ?? [])
      .map((row) => row.updateId ?? row.update_id)
      .filter((id): id is string => !!id);

    if (firstTime.length > 0) {
      await this.updatesRepository.increment({ id: In(firstTime) }, 'readCount', 1);
    }
    return { counted: firstTime.length };
  }

  // ── Nudges ─────────────────────────────────────────────────────────────────

  /**
   * Two reminders a founder gets, both once a day at most and both deduped so a
   * daily job cannot stack them:
   *
   *   - questions past the answering window, because an unanswered question is
   *     the thing their responsiveness figure is made of;
   *   - a project that has said nothing for a month, because a feed nobody is
   *     prompted to write dies in week three. This is the reminder the whole
   *     updates feature depends on: founders do not open the app on their own,
   *     they come when they are called.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendFounderNudges(): Promise<void> {
    try {
      await this.nudgeAboutUnansweredQuestions();
      await this.nudgeAboutSilence();
    } catch (err) {
      this.logger.error('Failed to send founder nudges', err as Error);
    }
  }

  private async nudgeAboutUnansweredQuestions(): Promise<void> {
    const rows: Array<{ project_id: string; founder_id: string; title: unknown; waiting: string }> =
      await this.projectsRepository.query(`
        SELECT q."project_id", p."founder_id", p."title", count(*)::text AS waiting
        FROM "project_questions" q
        JOIN "projects" p ON p."id" = q."project_id"
        WHERE q."answered_at" IS NULL
          AND q."hidden_at" IS NULL
          AND p."deleted_at" IS NULL
          AND q."created_at" < now() - interval '24 hours'
        GROUP BY q."project_id", p."founder_id", p."title"
      `);

    await this.notifications.notifyMany(
      rows.map((row) => ({
        userId: row.founder_id,
        type: NotificationType.QUESTIONS_AWAITING_ANSWER,
        payload: {
          projectId: row.project_id,
          projectTitle: row.title as Record<string, string>,
          quantity: Number(row.waiting),
        },
        // One pending nudge per project, however many days it stays true.
        dedupeKey: `questions_awaiting:${row.project_id}`,
      })),
    );
  }

  private async nudgeAboutSilence(): Promise<void> {
    // Only projects with money in them and people waiting on it. A project
    // nobody has invested in has nobody to tell.
    const rows: Array<{ id: string; founder_id: string; title: unknown }> =
      await this.projectsRepository.query(
        `
        SELECT p."id", p."founder_id", p."title"
        FROM "projects" p
        WHERE p."deleted_at" IS NULL
          AND p."status" = ANY($1)
          AND p."tickets_sold" > 0
          AND (p."last_update_at" IS NULL OR p."last_update_at" < now() - ($2 || ' days')::interval)
          AND p."created_at" < now() - ($2 || ' days')::interval
      `,
        [[ProjectStatus.ACTIVE, ProjectStatus.FUNDED], String(SILENT_AFTER_DAYS)],
      );

    await this.notifications.notifyMany(
      rows.map((row) => ({
        userId: row.founder_id,
        type: NotificationType.PROJECT_SILENT,
        payload: {
          projectId: row.id,
          projectTitle: row.title as Record<string, string>,
          quantity: SILENT_AFTER_DAYS,
        },
        dedupeKey: `project_silent:${row.id}`,
      })),
    );
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private async save(
    project: Project,
    author: User | null,
    fields: {
      title: string;
      body: string;
      photos: string[] | null;
      auto?: boolean;
      autoPayload?: Record<string, unknown>;
    },
  ): Promise<ProjectUpdate> {
    const post = await this.updatesRepository.save(
      this.updatesRepository.create({
        projectId: project.id,
        authorId: author?.id ?? null,
        title: fields.title,
        body: fields.body,
        photos: fields.photos,
        auto: fields.auto ?? false,
        autoPayload: fields.autoPayload ?? null,
      }),
    );

    // The silence clock only counts what a founder wrote. An automatic report
    // post is the platform talking, and letting it reset the timer would mean a
    // founder who never says a word looks like one who reports every month.
    if (!post.auto) {
      await this.projectsRepository.update({ id: project.id }, { lastUpdateAt: post.createdAt });
    }
    return post;
  }

  private async announce(project: Project, post: ProjectUpdate): Promise<void> {
    const holders = await this.tickets.holderIds(project.id);
    const messages: NotifyInput[] = holders
      .filter((holderId) => holderId !== project.founderId)
      .map((holderId) => ({
        userId: holderId,
        type: NotificationType.PROJECT_UPDATE_POSTED,
        payload: {
          projectId: project.id,
          projectTitle: project.title,
          updateId: post.id,
          excerpt: post.title,
        },
      }));
    await this.notifications.notifyMany(messages);
  }

  private async loadProject(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');
    return project;
  }

  private async load(id: string): Promise<ProjectUpdate> {
    const post = await this.updatesRepository.findOne({ where: { id }, relations: { author: true } });
    if (!post) throw new NotFoundException('Update not found');
    return post;
  }

  private present(post: ProjectUpdate, viewer: User | null, votes?: Map<string, Set<string>>) {
    const mine = !!viewer && post.authorId === viewer.id;
    const editableFor = EDIT_WINDOW_MINUTES * 60 * 1000 - (Date.now() - post.createdAt.getTime());
    return {
      id: post.id,
      projectId: post.projectId,
      title: post.title,
      body: post.body,
      photos: post.photos ?? [],
      auto: post.auto,
      autoPayload: post.autoPayload,
      author: toAuthor(post.author),
      helpfulCount: post.helpfulCount,
      readCount: post.readCount,
      editedAt: post.editedAt,
      mine,
      editable: mine && !post.auto && editableFor > 0,
      myVotes: [...(votes?.get(`${ContentTarget.UPDATE}:${post.id}`) ?? [])],
      createdAt: post.createdAt,
    };
  }
}
