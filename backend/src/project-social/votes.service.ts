import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ContentVote } from './entities/content-vote.entity';
import { ProjectQuestion } from './entities/project-question.entity';
import { ProjectAnswer } from './entities/project-answer.entity';
import { ProjectUpdate } from './entities/project-update.entity';
import { ContentTarget, ContentVoteKind } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-types';

// Which kinds make sense on which thing. A question takes "I want this answered
// too"; an answer takes the two verdicts on whether it answered anything; a post
// takes a plain thumbs-up. Anything else is a client bug and is refused rather
// than stored as a vote nothing will ever read.
const ALLOWED: Record<ContentTarget, ContentVoteKind[]> = {
  [ContentTarget.QUESTION]: [ContentVoteKind.UP],
  [ContentTarget.ANSWER]: [ContentVoteKind.HELPFUL, ContentVoteKind.NOT_ANSWER],
  [ContentTarget.UPDATE]: [ContentVoteKind.HELPFUL],
};

// Which column each kind maintains on its target.
const COUNTER: Record<ContentVoteKind, string> = {
  [ContentVoteKind.UP]: 'upvote_count',
  [ContentVoteKind.HELPFUL]: 'helpful_count',
  [ContentVoteKind.NOT_ANSWER]: 'not_answer_count',
};

const TABLE: Record<ContentTarget, string> = {
  [ContentTarget.QUESTION]: 'project_questions',
  [ContentTarget.ANSWER]: 'project_answers',
  [ContentTarget.UPDATE]: 'project_updates',
};

// Kept here rather than imported from questions.service to avoid the two
// services depending on each other in both directions.
const TRENDING_UPVOTES = 25;

@Injectable()
export class VotesService {
  constructor(
    @InjectRepository(ContentVote)
    private readonly votesRepository: Repository<ContentVote>,
    @InjectRepository(ProjectQuestion)
    private readonly questionsRepository: Repository<ProjectQuestion>,
    @InjectRepository(ProjectAnswer)
    private readonly answersRepository: Repository<ProjectAnswer>,
    @InjectRepository(ProjectUpdate)
    private readonly updatesRepository: Repository<ProjectUpdate>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Casts a vote, or takes it back if the same one is already there — one call
   * for both, because that is what a tap on a toggle means.
   *
   * The row and the counter move together in one transaction, and the counter is
   * incremented in SQL rather than read-modify-written in JS: two people voting
   * at the same moment would otherwise both read 40 and both write 41.
   */
  async toggle(
    userId: string,
    targetType: ContentTarget,
    targetId: string,
    kind: ContentVoteKind,
  ): Promise<{ voted: boolean; count: number }> {
    if (!ALLOWED[targetType]?.includes(kind)) {
      throw new BadRequestException(`A ${targetType} cannot be voted ${kind}`);
    }

    const owner = await this.ownerOf(targetType, targetId);
    // Voting for your own question is how a sort order stops meaning anything.
    if (owner.authorId && owner.authorId === userId) {
      throw new ForbiddenException('You cannot vote on your own content');
    }
    if (owner.hidden) throw new ForbiddenException('This content has been hidden');

    const result = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(ContentVote, {
        where: { userId, targetType, targetId, kind },
      });

      if (existing) {
        await manager.delete(ContentVote, { id: existing.id });
        const count = await this.bump(manager, targetType, targetId, kind, -1);
        return { voted: false, count };
      }

      // orIgnore covers the double-tap that arrives twice: the unique index
      // rejects the second, and we fall through to reporting the current count
      // rather than raising a conflict at somebody who pressed a button twice.
      //
      // `returning` is what makes that check work at all. Without it the insert
      // reports no rows either way, so a first, successful vote looked like a
      // duplicate and skipped the increment — the vote was stored and the
      // counter stayed at zero. With ON CONFLICT DO NOTHING … RETURNING, an
      // empty result means exactly one thing: somebody else already had it.
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(ContentVote)
        .values({ userId, targetType, targetId, kind })
        .orIgnore()
        .returning(['id'])
        .execute();
      if (((inserted.raw as unknown[]) ?? []).length === 0) {
        return { voted: true, count: await this.currentCount(manager, targetType, targetId, kind) };
      }
      const count = await this.bump(manager, targetType, targetId, kind, 1);
      return { voted: true, count };
    });

    // Exactly on the threshold, not past it: `>=` would fire again on 26, 27
    // and every vote after that. The dedupe key covers the other repeat — a vote
    // taken back and recast crosses the same line twice — but only while the
    // first notification is still unread, so the two together are what make this
    // a once-per-question event.
    if (
      result.voted &&
      targetType === ContentTarget.QUESTION &&
      kind === ContentVoteKind.UP &&
      result.count === TRENDING_UPVOTES
    ) {
      await this.announceTrending(targetId, result.count);
    }

    return result;
  }

  /**
   * Which of these the viewer has already voted on, as `type:id` → kinds. One
   * query for a whole screen; without it every row on the list would need its
   * own lookup to know whether to draw the button pressed.
   */
  async myVotesFor(
    userId: string | null,
    targets: Array<{ type: ContentTarget | 'question' | 'answer' | 'update'; id: string }>,
  ): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();
    if (!userId || targets.length === 0) return map;

    const votes = await this.votesRepository.find({
      where: {
        userId,
        targetId: In([...new Set(targets.map((target) => target.id))]),
      },
    });
    for (const vote of votes) {
      const key = `${vote.targetType}:${vote.targetId}`;
      const kinds = map.get(key) ?? new Set<string>();
      kinds.add(vote.kind);
      map.set(key, kinds);
    }
    return map;
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private async bump(
    manager: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    targetType: ContentTarget,
    targetId: string,
    kind: ContentVoteKind,
    delta: number,
  ): Promise<number> {
    // GREATEST(…, 0) is a floor, not a fix: nothing should ever decrement below
    // zero, and if a bug ever does, a visible count of 0 beats a negative one.
    await manager.query(
      `UPDATE "${TABLE[targetType]}"
         SET "${COUNTER[kind]}" = GREATEST("${COUNTER[kind]}" + $2, 0)
       WHERE "id" = $1`,
      [targetId, delta],
    );
    // Read back rather than RETURNING: what `query` hands back for an UPDATE is
    // driver-shaped and not the plain row list it looks like, and reading the
    // count out of it returned zero while the column really held one — a button
    // that worked but always displayed nothing. Both statements are inside the
    // caller's transaction, so the value read here is the one just written.
    return this.currentCount(manager, targetType, targetId, kind);
  }

  private async currentCount(
    manager: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    targetType: ContentTarget,
    targetId: string,
    kind: ContentVoteKind,
  ): Promise<number> {
    const rows = (await manager.query(
      `SELECT "${COUNTER[kind]}" AS count FROM "${TABLE[targetType]}" WHERE "id" = $1`,
      [targetId],
    )) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  private async ownerOf(
    targetType: ContentTarget,
    targetId: string,
  ): Promise<{ authorId: string | null; hidden: boolean }> {
    if (targetType === ContentTarget.QUESTION) {
      const row = await this.questionsRepository.findOne({
        where: { id: targetId },
        select: { authorId: true, hiddenAt: true },
      });
      if (!row) throw new NotFoundException('Question not found');
      return { authorId: row.authorId, hidden: !!row.hiddenAt };
    }
    if (targetType === ContentTarget.ANSWER) {
      const row = await this.answersRepository.findOne({
        where: { id: targetId },
        select: { authorId: true, hiddenAt: true },
      });
      if (!row) throw new NotFoundException('Answer not found');
      return { authorId: row.authorId, hidden: !!row.hiddenAt };
    }
    const row = await this.updatesRepository.findOne({
      where: { id: targetId },
      select: { authorId: true, hiddenAt: true },
    });
    if (!row) throw new NotFoundException('Update not found');
    return { authorId: row.authorId, hidden: !!row.hiddenAt };
  }

  /**
   * Tells the asker their question has struck a nerve. Deduped on the question
   * id, so crossing the threshold notifies once and every vote after it is
   * silent — without the key this fires on 25, 26, 27 and so on.
   */
  private async announceTrending(questionId: string, count: number): Promise<void> {
    const question = await this.questionsRepository.findOne({
      where: { id: questionId },
      relations: { project: true },
    });
    if (!question?.authorId) return;
    await this.notifications.notify({
      userId: question.authorId,
      type: NotificationType.QUESTION_TRENDING,
      payload: {
        projectId: question.projectId,
        projectTitle: question.project?.title ?? null,
        questionId,
        quantity: count,
      },
      dedupeKey: `question_trending:${questionId}`,
    });
  }
}
