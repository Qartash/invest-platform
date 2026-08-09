import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ProjectQuestion } from './entities/project-question.entity';
import { ProjectAnswer } from './entities/project-answer.entity';
import { QuestionFollow } from './entities/question-follow.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotifyInput } from '../notifications/notification-types';
import { AnswerQuestionDto, AskQuestionDto } from './dto/question.dto';
import { VotesService } from './votes.service';
import { UpdatesService } from './updates.service';
import { toAuthor } from './presenters';
import {
  MAX_QUESTIONS_PER_DAY,
  MAX_QUESTIONS_PER_PROJECT_PER_DAY,
  acceptsQuestions,
  canAmendQuestion,
  canAsk,
  isFounderAnswer,
  questionAllowance,
} from './question-rules';

export type QuestionSort = 'top' | 'new' | 'unanswered';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(ProjectQuestion)
    private readonly questionsRepository: Repository<ProjectQuestion>,
    @InjectRepository(ProjectAnswer)
    private readonly answersRepository: Repository<ProjectAnswer>,
    @InjectRepository(QuestionFollow)
    private readonly followsRepository: Repository<QuestionFollow>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly votes: VotesService,
    private readonly updates: UpdatesService,
  ) {}

  // ── Asking ─────────────────────────────────────────────────────────────────

  async ask(user: User, projectId: string, dto: AskQuestionDto): Promise<unknown> {
    const project = await this.loadOpenProject(projectId);
    if (!canAsk(project, user.id)) {
      throw new ForbiddenException('A founder cannot ask their own project a question');
    }

    await this.assertUnderDailyLimits(user.id, projectId);

    const question = await this.questionsRepository.save(
      this.questionsRepository.create({
        projectId,
        authorId: user.id,
        body: dto.body.trim(),
      }),
    );

    // Asking is following: the whole reason to ask is to hear the answer.
    await this.follow(user.id, question.id, true);
    await this.recomputeResponsiveness(projectId);

    await this.notifications.notify({
      userId: project.founderId,
      type: NotificationType.QUESTION_ASKED,
      payload: {
        projectId,
        projectTitle: project.title,
        questionId: question.id,
        excerpt: question.body.slice(0, 120),
      },
    });

    return this.presentQuestion(await this.loadQuestion(question.id), user, { answers: [] });
  }

  /**
   * The author fixing their own wording. Only while nobody has replied: once an
   * answer exists it is an answer to particular words, and editing them
   * afterwards rewrites what the founder was responding to.
   */
  async editQuestion(user: User, questionId: string, body: string): Promise<unknown> {
    const question = await this.loadQuestion(questionId);
    if (question.authorId !== user.id) throw new ForbiddenException('Not your question');

    const replyCount = await this.answersRepository.count({ where: { questionId } });
    if (!canAmendQuestion({ ...question, replyCount }, user.id)) {
      throw new BadRequestException('A question that has been answered can no longer be edited');
    }

    question.body = body.trim();
    await this.questionsRepository.save(question);
    return this.presentQuestion(question, user, { answers: [] });
  }

  /** Same window as editing, and for the same reason. */
  async deleteQuestion(user: User, questionId: string): Promise<{ deleted: true }> {
    const question = await this.loadQuestion(questionId);
    const isModerator = user.role === UserRole.ADMIN;
    if (question.authorId !== user.id && !isModerator) throw new ForbiddenException('Not your question');

    if (!isModerator) {
      const replyCount = await this.answersRepository.count({ where: { questionId } });
      if (!canAmendQuestion({ ...question, replyCount }, user.id)) {
        throw new BadRequestException('A question that has been answered can no longer be deleted');
      }
    }

    await this.questionsRepository.delete({ id: questionId });
    await this.recomputeResponsiveness(question.projectId);
    return { deleted: true };
  }

  // ── Answering ──────────────────────────────────────────────────────────────

  /**
   * One endpoint, two meanings. From the founder it is *the* answer: it stamps
   * `answeredAt` the first time and moves the project's responsiveness figures.
   * From anybody else it is a follow-up in the thread, which changes no figures
   * at all — otherwise a founder could clear their own queue by having a friend
   * reply.
   */
  async answer(user: User, questionId: string, dto: AnswerQuestionDto): Promise<unknown> {
    const question = await this.loadQuestion(questionId);
    if (question.hiddenAt) throw new ForbiddenException('This question has been hidden');

    const project = await this.projectsRepository.findOne({ where: { id: question.projectId } });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');

    const fromFounder = isFounderAnswer(project, user.id);
    if ((dto.alsoPostAsUpdate || dto.pin) && !fromFounder) {
      throw new ForbiddenException('Only the founder can pin a question or post an answer as an update');
    }

    const body = dto.body.trim();
    const answer = await this.answersRepository.save(
      this.answersRepository.create({ questionId, authorId: user.id, body, fromFounder }),
    );

    // Whoever joins the conversation hears the rest of it.
    await this.follow(user.id, questionId, true);

    const firstFounderAnswer = fromFounder && !question.answeredAt;
    if (firstFounderAnswer) {
      question.answeredAt = answer.createdAt;
    }
    if (dto.pin !== undefined && fromFounder) {
      question.pinned = !!dto.pin;
    }
    if (firstFounderAnswer || dto.pin !== undefined) {
      await this.questionsRepository.save(question);
    }
    if (firstFounderAnswer) {
      await this.recomputeResponsiveness(project.id);
    }

    // The switch that turns one answer into news for everybody who paid, rather
    // than for the people already reading this thread.
    if (dto.alsoPostAsUpdate) {
      await this.updates.postFromAnswer(project, user, question, body);
    }

    await this.notifyThread(project, question, user, fromFounder, body);

    return this.presentAnswer(await this.loadAnswer(answer.id), user);
  }

  /**
   * Two audiences, deliberately kept apart. The person who asked is told their
   * question was answered — that is the notification the whole feature exists
   * for. Everyone else following the thread gets the quieter "there is a new
   * reply", including when the reply came from another investor.
   */
  private async notifyThread(
    project: Project,
    question: ProjectQuestion,
    actor: User,
    fromFounder: boolean,
    body: string,
  ): Promise<void> {
    const about = {
      projectId: project.id,
      projectTitle: project.title,
      questionId: question.id,
      excerpt: body.slice(0, 120),
      actorName: actor.showFullName ? actor.fullName : null,
    };

    const messages: NotifyInput[] = [];
    if (fromFounder && question.authorId && question.authorId !== actor.id) {
      messages.push({
        userId: question.authorId,
        type: NotificationType.QUESTION_ANSWERED,
        payload: about,
      });
    }

    const followers = await this.followsRepository.find({
      where: { questionId: question.id },
      select: { userId: true },
    });
    const alreadyTold = new Set([actor.id, ...messages.map((m) => m.userId)]);
    for (const follower of followers) {
      if (alreadyTold.has(follower.userId)) continue;
      messages.push({
        userId: follower.userId,
        type: NotificationType.QUESTION_THREAD_REPLY,
        payload: about,
      });
    }

    await this.notifications.notifyMany(messages);
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  /**
   * The list under a project. Pinned first, then whatever order was asked for:
   * `top` by votes (what a reader wants), `new` by recency, `unanswered` for the
   * founder's queue and for the investor checking whether anything is being
   * ignored.
   */
  async listForProject(
    projectId: string,
    viewer: User | null,
    options: { sort?: QuestionSort; page?: number; pageSize?: number; includeHidden?: boolean } = {},
  ) {
    const sort = options.sort ?? 'top';
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));

    const query = this.questionsRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.author', 'author')
      .where('question.project_id = :projectId', { projectId });

    // Hidden questions stay in the database and out of everyone's way — except
    // the moderator reviewing what was hidden, and the author, who is told it
    // happened and should be able to see what became of their words.
    if (!options.includeHidden) {
      if (viewer) {
        query.andWhere('(question.hidden_at IS NULL OR question.author_id = :viewerId)', {
          viewerId: viewer.id,
        });
      } else {
        query.andWhere('question.hidden_at IS NULL');
      }
    }

    if (sort === 'unanswered') query.andWhere('question.answered_at IS NULL');

    query.orderBy('question.pinned', 'DESC');
    if (sort === 'top') {
      query.addOrderBy('question.upvote_count', 'DESC').addOrderBy('question.created_at', 'DESC');
    } else {
      query.addOrderBy('question.created_at', 'DESC');
    }

    const [questions, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // One query for every answer on the page rather than one per question: a
    // list of twenty questions each showing its founder answer is the single
    // most-loaded screen this feature adds.
    const answers = await this.answersForQuestions(questions.map((q) => q.id));
    const myVotes = await this.votes.myVotesFor(viewer?.id ?? null, [
      ...questions.map((q) => ({ type: 'question' as const, id: q.id })),
      ...[...answers.values()].flat().map((a) => ({ type: 'answer' as const, id: a.id })),
    ]);
    const following = await this.followedIds(viewer?.id ?? null, questions.map((q) => q.id));

    return {
      items: questions.map((question) =>
        this.presentQuestion(question, viewer, {
          answers: answers.get(question.id) ?? [],
          votes: myVotes,
          following: following.has(question.id),
        }),
      ),
      total,
      page,
      pageSize,
      unanswered: await this.questionsRepository.count({
        where: { projectId, answeredAt: IsNull(), hiddenAt: IsNull() },
      }),
    };
  }

  /** One thread, with every follow-up under it. */
  async getThread(questionId: string, viewer: User | null) {
    const question = await this.loadQuestion(questionId);
    const answers = (await this.answersForQuestions([questionId])).get(questionId) ?? [];
    const myVotes = await this.votes.myVotesFor(viewer?.id ?? null, [
      { type: 'question', id: question.id },
      ...answers.map((a) => ({ type: 'answer' as const, id: a.id })),
    ]);
    const following = await this.followedIds(viewer?.id ?? null, [questionId]);
    return this.presentQuestion(question, viewer, {
      answers,
      votes: myVotes,
      following: following.has(questionId),
    });
  }

  /**
   * What the ask screen shows before anything is sent: questions on this project
   * that already read like the one being typed. Half the duplicates never get
   * asked, which is half the founder's queue that never appears.
   *
   * Plain ILIKE over the longest words rather than full-text search: the corpus
   * is one project's questions, the app is trilingual, and Postgres has no
   * Armenian dictionary to build a tsvector with.
   */
  async findSimilar(projectId: string, text: string, limit = 3) {
    const words = text
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((word) => word.length >= 4)
      .sort((a, b) => b.length - a.length)
      .slice(0, 4);
    if (words.length === 0) return [];

    const query = this.questionsRepository
      .createQueryBuilder('question')
      .where('question.project_id = :projectId', { projectId })
      .andWhere('question.hidden_at IS NULL');
    query.andWhere(
      `(${words.map((_, i) => `question.body ILIKE :word${i}`).join(' OR ')})`,
      Object.fromEntries(words.map((word, i) => [`word${i}`, `%${word}%`])),
    );

    const found = await query
      .orderBy('question.answered_at IS NOT NULL', 'DESC')
      .addOrderBy('question.upvote_count', 'DESC')
      .take(limit)
      .getMany();

    return found.map((question) => ({
      id: question.id,
      body: question.body,
      answered: !!question.answeredAt,
      upvoteCount: question.upvoteCount,
      createdAt: question.createdAt,
    }));
  }

  // ── Following ──────────────────────────────────────────────────────────────

  async follow(userId: string, questionId: string, on: boolean): Promise<{ following: boolean }> {
    if (on) {
      // Racing with itself is normal here — two answers written at once by the
      // same person, an app retrying — and the unique index is what makes it
      // safe. `orIgnore` turns the collision into a no-op instead of a 500.
      await this.followsRepository
        .createQueryBuilder()
        .insert()
        .values({ userId, questionId })
        .orIgnore()
        .execute();
    } else {
      await this.followsRepository.delete({ userId, questionId });
    }
    return { following: on };
  }

  private async followedIds(userId: string | null, questionIds: string[]): Promise<Set<string>> {
    if (!userId || questionIds.length === 0) return new Set();
    const rows = await this.followsRepository.find({
      where: { userId, questionId: In(questionIds) },
      select: { questionId: true },
    });
    return new Set(rows.map((row) => row.questionId));
  }

  // ── The figures on the project ─────────────────────────────────────────────

  /**
   * Recomputes the three numbers the catalogue badge is built from, in one
   * statement, for one project.
   *
   * Done in SQL rather than by keeping running totals because the inputs change
   * in ways a counter cannot follow: a question is deleted before it was
   * answered, a moderator hides one, an old thread finally gets a reply. Every
   * one of those makes an incremented counter wrong forever, while this is
   * simply the answer to the question as it stands. It runs on the handful of
   * questions belonging to a single project, when an answer is written — not on
   * a read path.
   *
   * Hidden questions are excluded on purpose: a founder must not be able to
   * improve their own score by getting an awkward question taken down, and the
   * moderator who hides spam should not be dragging the founder's record with it
   * either.
   */
  async recomputeResponsiveness(projectId: string): Promise<void> {
    await this.projectsRepository.query(
      `
      UPDATE "projects" p SET
        "questions_count" = s.total,
        "questions_answered_count" = s.answered,
        "answer_median_minutes" = s.median
      FROM (
        SELECT
          count(*)::int AS total,
          count("answered_at")::int AS answered,
          ROUND(
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("answered_at" - "created_at")) / 60
            ) FILTER (WHERE "answered_at" IS NOT NULL)
          )::int AS median
        FROM "project_questions"
        WHERE "project_id" = $1 AND "hidden_at" IS NULL
      ) s
      WHERE p."id" = $1
      `,
      [projectId],
    );
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private async loadOpenProject(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');
    if (!acceptsQuestions(project)) {
      throw new BadRequestException('This project is not taking questions');
    }
    return project;
  }

  private async loadQuestion(id: string): Promise<ProjectQuestion> {
    const question = await this.questionsRepository.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  private async loadAnswer(id: string): Promise<ProjectAnswer> {
    const answer = await this.answersRepository.findOne({ where: { id }, relations: { author: true } });
    if (!answer) throw new NotFoundException('Answer not found');
    return answer;
  }

  private async answersForQuestions(questionIds: string[]): Promise<Map<string, ProjectAnswer[]>> {
    const byQuestion = new Map<string, ProjectAnswer[]>();
    if (questionIds.length === 0) return byQuestion;
    const answers = await this.answersRepository.find({
      where: { questionId: In(questionIds) },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });
    for (const answer of answers) {
      const bucket = byQuestion.get(answer.questionId) ?? [];
      bucket.push(answer);
      byQuestion.set(answer.questionId, bucket);
    }
    return byQuestion;
  }

  private async assertUnderDailyLimits(userId: string, projectId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [onProject, overall] = await Promise.all([
      this.questionsRepository
        .createQueryBuilder('question')
        .where('question.author_id = :userId', { userId })
        .andWhere('question.project_id = :projectId', { projectId })
        .andWhere('question.created_at > :since', { since })
        .getCount(),
      this.questionsRepository
        .createQueryBuilder('question')
        .where('question.author_id = :userId', { userId })
        .andWhere('question.created_at > :since', { since })
        .getCount(),
    ]);

    const allowance = questionAllowance({ onThisProject: onProject, today: overall });
    if (!allowance.allowed) {
      throw new BadRequestException(
        allowance.limit === 'project'
          ? `No more than ${MAX_QUESTIONS_PER_PROJECT_PER_DAY} questions a day on one project`
          : `No more than ${MAX_QUESTIONS_PER_DAY} questions a day`,
      );
    }
  }

  // ── Shapes the app reads ───────────────────────────────────────────────────

  private presentQuestion(
    question: ProjectQuestion,
    viewer: User | null,
    extras: {
      answers: ProjectAnswer[];
      votes?: Map<string, Set<string>>;
      following?: boolean;
    },
  ) {
    const mine = !!viewer && question.authorId === viewer.id;
    return {
      id: question.id,
      projectId: question.projectId,
      body: question.hiddenAt && !mine ? null : question.body,
      author: toAuthor(question.author),
      upvoteCount: question.upvoteCount,
      pinned: question.pinned,
      answered: !!question.answeredAt,
      answeredAt: question.answeredAt,
      hidden: !!question.hiddenAt,
      hiddenReason: mine ? question.hiddenReason : null,
      mine,
      // Whether the question can still be taken back — the app greys the menu
      // out rather than offering an action the server will refuse.
      editable: mine && extras.answers.length === 0 && !question.hiddenAt,
      following: extras.following ?? false,
      myVotes: [...(extras.votes?.get(`question:${question.id}`) ?? [])],
      answers: extras.answers
        .filter((answer) => !answer.hiddenAt || (viewer && answer.authorId === viewer.id))
        .map((answer) => this.presentAnswer(answer, viewer, extras.votes)),
      createdAt: question.createdAt,
    };
  }

  private presentAnswer(answer: ProjectAnswer, viewer: User | null, votes?: Map<string, Set<string>>) {
    const mine = !!viewer && answer.authorId === viewer.id;
    return {
      id: answer.id,
      questionId: answer.questionId,
      body: answer.body,
      author: toAuthor(answer.author),
      fromFounder: answer.fromFounder,
      helpfulCount: answer.helpfulCount,
      notAnswerCount: answer.notAnswerCount,
      hidden: !!answer.hiddenAt,
      hiddenReason: mine ? answer.hiddenReason : null,
      mine,
      myVotes: [...(votes?.get(`answer:${answer.id}`) ?? [])],
      createdAt: answer.createdAt,
    };
  }
}
