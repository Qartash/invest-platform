import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentReport } from './entities/content-report.entity';
import { ProjectQuestion } from './entities/project-question.entity';
import { ProjectAnswer } from './entities/project-answer.entity';
import { ProjectUpdate } from './entities/project-update.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { ContentReportStatus, ContentTarget } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-types';
import { ReportContentDto, ResolveReportDto } from './dto/question.dto';
import { QuestionsService } from './questions.service';
import { toAuthor } from './presenters';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ContentReport)
    private readonly reportsRepository: Repository<ContentReport>,
    @InjectRepository(ProjectQuestion)
    private readonly questionsRepository: Repository<ProjectQuestion>,
    @InjectRepository(ProjectAnswer)
    private readonly answersRepository: Repository<ProjectAnswer>,
    @InjectRepository(ProjectUpdate)
    private readonly updatesRepository: Repository<ProjectUpdate>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly notifications: NotificationsService,
    private readonly questions: QuestionsService,
  ) {}

  // ── Reporting ──────────────────────────────────────────────────────────────

  async report(user: User, targetType: ContentTarget, targetId: string, dto: ReportContentDto) {
    const target = await this.resolveTarget(targetType, targetId);

    // One report per person per thing. A second one is not a stronger objection,
    // and a queue that counts them would let one determined person look like a
    // crowd.
    const existing = await this.reportsRepository.findOne({
      where: { reporterId: user.id, targetType, targetId },
    });
    if (existing) return { reported: true };

    await this.reportsRepository.save(
      this.reportsRepository.create({
        reporterId: user.id,
        targetType,
        targetId,
        projectId: target.projectId ?? undefined,
        reason: dto.reason,
        comment: dto.comment?.trim() ?? null,
      }),
    );

    // Moderators are told once per target, not once per report: three people
    // objecting to the same comment is one thing to look at.
    await this.notifications.notifyAdmins(
      NotificationType.MOD_CONTENT_REPORTED,
      { projectId: target.projectId ?? undefined, targetType, targetId },
      { dedupeKey: `content_reported:${targetType}:${targetId}` },
    );

    return { reported: true };
  }

  // ── The queue ──────────────────────────────────────────────────────────────

  async listReports(status: ContentReportStatus = ContentReportStatus.PENDING) {
    const reports = await this.reportsRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take: 200,
    });

    // Grouped by what was reported, because that is the unit of decision: the
    // moderator hides a comment once, however many people flagged it.
    const grouped = new Map<string, { targetType: ContentTarget; targetId: string; reports: ContentReport[] }>();
    for (const report of reports) {
      const key = `${report.targetType}:${report.targetId}`;
      const bucket = grouped.get(key) ?? {
        targetType: report.targetType,
        targetId: report.targetId,
        reports: [],
      };
      bucket.reports.push(report);
      grouped.set(key, bucket);
    }

    return Promise.all(
      [...grouped.values()].map(async (group) => ({
        targetType: group.targetType,
        targetId: group.targetId,
        reportCount: group.reports.length,
        reasons: [...new Set(group.reports.map((report) => report.reason))],
        comments: group.reports.map((report) => report.comment).filter(Boolean),
        firstReportedAt: group.reports[group.reports.length - 1].createdAt,
        content: await this.describeTarget(group.targetType, group.targetId),
      })),
    );
  }

  /**
   * The projects a moderator should be looking at: unanswered questions piling
   * up, or nothing said for weeks. Neither is a rule violation — it is the list
   * of founders whose investors are being left in the dark, which is the thing
   * this whole feature was built to make visible.
   */
  async listNeglectedProjects() {
    const rows: Array<{
      id: string;
      title: unknown;
      unanswered: string;
      silent_days: string | null;
    }> = await this.projectsRepository.query(`
      SELECT p."id", p."title",
             count(q."id") FILTER (WHERE q."answered_at" IS NULL AND q."hidden_at" IS NULL)::text AS unanswered,
             CASE WHEN p."last_update_at" IS NULL THEN NULL
                  ELSE EXTRACT(DAY FROM now() - p."last_update_at")::text END AS silent_days
      FROM "projects" p
      LEFT JOIN "project_questions" q ON q."project_id" = p."id"
      WHERE p."deleted_at" IS NULL AND p."tickets_sold" > 0
      GROUP BY p."id", p."title", p."last_update_at"
      HAVING count(q."id") FILTER (WHERE q."answered_at" IS NULL AND q."hidden_at" IS NULL) > 0
          OR p."last_update_at" IS NULL
          OR p."last_update_at" < now() - interval '30 days'
      ORDER BY unanswered DESC NULLS LAST
      LIMIT 50
    `);

    return rows.map((row) => ({
      projectId: row.id,
      title: row.title,
      unansweredCount: Number(row.unanswered),
      silentDays: row.silent_days === null ? null : Number(row.silent_days),
    }));
  }

  // ── Deciding ───────────────────────────────────────────────────────────────

  /**
   * Hides the content or dismisses the complaint, and closes every report
   * against that target in one go.
   *
   * Hiding is not deleting, anywhere in here. The row keeps its text and gains a
   * reason, the author is told what happened and why, and a moderator reviewing
   * their own past decisions can still read what they took down. "You silently
   * erased my question" is the accusation this design exists to make impossible.
   */
  async resolve(moderator: User, targetType: ContentTarget, targetId: string, dto: ResolveReportDto) {
    if (dto.status === ContentReportStatus.HIDDEN && !dto.reason?.trim()) {
      throw new BadRequestException('Hiding content requires a reason — the author is shown it');
    }

    const target = await this.resolveTarget(targetType, targetId);

    if (dto.status === ContentReportStatus.HIDDEN) {
      await this.hide(targetType, targetId, moderator.id, dto.reason!.trim());

      if (target.authorId) {
        await this.notifications.notify({
          userId: target.authorId,
          type: NotificationType.CONTENT_HIDDEN,
          payload: {
            projectId: target.projectId ?? undefined,
            targetType,
            targetId,
            comment: dto.reason!.trim(),
          },
        });
      }

      // A hidden question leaves the responsiveness figures, in both directions:
      // a founder cannot improve their score by having awkward questions taken
      // down, and spam removed by a moderator stops counting against them.
      if (targetType === ContentTarget.QUESTION && target.projectId) {
        await this.questions.recomputeResponsiveness(target.projectId);
      }
    }

    await this.reportsRepository.update(
      { targetType, targetId, status: ContentReportStatus.PENDING },
      {
        status: dto.status,
        resolvedByUserId: moderator.id,
        resolvedAt: new Date(),
      },
    );

    return { status: dto.status };
  }

  /** Puts hidden content back. The reports stay resolved; only the veil lifts. */
  async unhide(targetType: ContentTarget, targetId: string) {
    const repository = this.repositoryFor(targetType);
    await repository.update({ id: targetId } as never, {
      hiddenAt: null,
      hiddenReason: null,
      hiddenByUserId: null,
    } as never);

    const target = await this.resolveTarget(targetType, targetId);
    if (targetType === ContentTarget.QUESTION && target.projectId) {
      await this.questions.recomputeResponsiveness(target.projectId);
    }
    return { hidden: false };
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private async hide(
    targetType: ContentTarget,
    targetId: string,
    moderatorId: string,
    reason: string,
  ): Promise<void> {
    const repository = this.repositoryFor(targetType);
    await repository.update({ id: targetId } as never, {
      hiddenAt: new Date(),
      hiddenReason: reason,
      hiddenByUserId: moderatorId,
    } as never);
  }

  private repositoryFor(targetType: ContentTarget) {
    if (targetType === ContentTarget.QUESTION) return this.questionsRepository;
    if (targetType === ContentTarget.ANSWER) return this.answersRepository;
    return this.updatesRepository;
  }

  /** Who wrote it and which project it belongs to — the two things every path here needs. */
  private async resolveTarget(
    targetType: ContentTarget,
    targetId: string,
  ): Promise<{ authorId: string | null; projectId: string | null }> {
    if (targetType === ContentTarget.QUESTION) {
      const question = await this.questionsRepository.findOne({ where: { id: targetId } });
      if (!question) throw new NotFoundException('Question not found');
      return { authorId: question.authorId, projectId: question.projectId };
    }
    if (targetType === ContentTarget.ANSWER) {
      const answer = await this.answersRepository.findOne({
        where: { id: targetId },
        relations: { question: true },
      });
      if (!answer) throw new NotFoundException('Answer not found');
      return { authorId: answer.authorId, projectId: answer.question?.projectId ?? null };
    }
    const post = await this.updatesRepository.findOne({ where: { id: targetId } });
    if (!post) throw new NotFoundException('Update not found');
    return { authorId: post.authorId, projectId: post.projectId };
  }

  /** The text and author a moderator needs to see to decide anything. */
  private async describeTarget(targetType: ContentTarget, targetId: string) {
    if (targetType === ContentTarget.QUESTION) {
      const question = await this.questionsRepository.findOne({
        where: { id: targetId },
        relations: { author: true, project: true },
      });
      return question
        ? {
            body: question.body,
            author: toAuthor(question.author),
            hidden: !!question.hiddenAt,
            projectTitle: question.project?.title ?? null,
            createdAt: question.createdAt,
          }
        : null;
    }
    if (targetType === ContentTarget.ANSWER) {
      const answer = await this.answersRepository.findOne({
        where: { id: targetId },
        relations: { author: true, question: { project: true } },
      });
      return answer
        ? {
            body: answer.body,
            author: toAuthor(answer.author),
            hidden: !!answer.hiddenAt,
            fromFounder: answer.fromFounder,
            projectTitle: answer.question?.project?.title ?? null,
            createdAt: answer.createdAt,
          }
        : null;
    }
    const post = await this.updatesRepository.findOne({
      where: { id: targetId },
      relations: { author: true, project: true },
    });
    return post
      ? {
          body: `${post.title}\n${post.body}`,
          author: toAuthor(post.author),
          hidden: !!post.hiddenAt,
          projectTitle: post.project?.title ?? null,
          createdAt: post.createdAt,
        }
      : null;
  }
}
