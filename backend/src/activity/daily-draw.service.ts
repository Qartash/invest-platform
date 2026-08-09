import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DailyDrawAward } from './entities/daily-draw-award.entity';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { User } from '../users/entities/user.entity';
import { RewardsService } from './rewards.service';
import { TransactionType, UserRole } from '../common/enums';
import { completedDaysBefore, ymd } from './streak';
import { DRAW_SHARE, POOL_PER_ARRIVAL, poolFor, seatsFor } from './draw-pool';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-types';
import { withCronLock } from '../common/cron-lock';

/**
 * How far back a catch-up run will look for days the draw never happened on.
 *
 * A week covers the case this exists for: the API sleeps when nothing is calling it, and
 * a night with no traffic is a night the ten-o'clock schedule never fires. Longer than
 * this and a draw would be paid out to people who have long since stopped wondering about
 * it — past a week, a missed day is history rather than something owed.
 */
const CATCH_UP_DAYS = 7;

/** One day of the draw, as it concerns one person. See `statsFor`. */
export interface DrawDay {
  date: string;
  organicArrivals: number;
  pool: number;
  seats: number;
  participants: number;
  winners: number;
  /** Whether the draw has already paid out for this day. */
  drawn: boolean;
  /** What this user won that day, 0 if nothing. */
  youWon: number;
  /** Whether this user was in that day's pool of participants. */
  youIn: boolean;
}

/**
 * The draw that replaces attributing a code-less sign-up to a random stranger.
 *
 * Someone who arrives on their own earns nobody a referral bonus — the tree only
 * ever shows real invitations. In exchange the platform puts up what that
 * arrival would have cost the ladder and splits it between people who were
 * active that day. The rate is a number we choose, the spend follows arrivals
 * rather than the size of the crowd, and nothing about the tree is invented.
 */
@Injectable()
export class DailyDrawService implements OnModuleInit {
  private readonly logger = new Logger(DailyDrawService.name);

  constructor(
    @InjectRepository(DailyDrawAward)
    private readonly awardsRepository: Repository<DailyDrawAward>,
    @InjectRepository(DailyCheckin)
    private readonly checkinsRepository: Repository<DailyCheckin>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rewardsService: RewardsService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The draw is the one job here that a missed run loses for good.
   *
   * Everything else on a schedule asks the database a question that stays true until it is
   * answered — earnings past their hold date are still past it an hour later, an unanswered
   * question is still unanswered tomorrow — so a run that never happens is a delay. The draw
   * asked only about *today*, and by the time the next run came round "today" meant a
   * different day: the missed one was never drawn and never would be. On a service that
   * sleeps through any night nobody is using it, that is most nights.
   *
   * So the schedule is no longer the only thing that starts it. Waking up counts too, and
   * since waking up is what happens the moment somebody opens the app, the days that were
   * missed while it slept get drawn shortly after anybody arrives.
   */
  onModuleInit(): void {
    // Deliberately not awaited: boot must not wait on a week of draws, and a failure here
    // must not take the API down with it. Nothing else depends on it having finished.
    void this.catchUpMissedDraws().catch((err) =>
      this.logger.error('Catch-up draw run failed', err as Error),
    );
  }

  // Late in the day, so "active today" means most of the day has happened.
  @Cron(CronExpression.EVERY_DAY_AT_10PM)
  async runTodaysDraw(): Promise<void> {
    await withCronLock(this.dataSource, 'daily-draw', () => this.draw(ymd(new Date())));
  }

  /**
   * Draws every completed day in the window that has no awards against it.
   *
   * Only days that have *ended*: drawing today at nine in the morning would settle it
   * against whoever happened to have opened the app by breakfast and shut out everyone
   * who came later, which is worse than not drawing it at all. Today belongs to the
   * ten-o'clock run.
   *
   * Oldest first, so a week of arrears is paid in the order it accrued and the pot for
   * each day is the one that day earned. `draw` is what makes this safe to call as often
   * as it likes — a day with awards already recorded returns immediately.
   */
  async catchUpMissedDraws(days = CATCH_UP_DAYS): Promise<void> {
    await withCronLock(this.dataSource, 'daily-draw', async () => {
      for (const day of completedDaysBefore(new Date(), days)) {
        const result = await this.draw(day);
        if (result.winners > 0) {
          this.logger.log(`Caught up the draw for ${day}: ${result.winners} winner(s)`);
        }
      }
    });
  }

  // Split out from the schedule so it can be run for a given day and tested.
  async draw(day: string): Promise<{ winners: number; amount: number; organicArrivals: number }> {
    const done = await this.awardsRepository.count({ where: { drawDate: day } });
    if (done > 0) return { winners: 0, amount: 0, organicArrivals: 0 };

    const organicArrivals = await this.countOrganicArrivals(day);
    // No one arrived on their own — there is nothing for the draw to stand in for.
    if (organicArrivals === 0) return { winners: 0, amount: 0, organicArrivals: 0 };

    const eligible = await this.eligibleUserIds(day);
    if (eligible.length === 0) return { winners: 0, amount: 0, organicArrivals };

    // The pot follows the arrivals it stands in for, so a day ten times the size
    // seats ten times as many winners and one person's odds hold.
    const winners = DailyDrawService.pickRandom(eligible, seatsFor(organicArrivals));

    let paid = 0;
    for (const userId of winners) {
      const amount = await this.rewardsService.award(
        userId,
        DRAW_SHARE,
        'Daily bonus draw',
        TransactionType.QUEST_REWARD,
      );
      // A reward that could not be funded is not recorded as a win, so the person
      // is never shown a prize they did not receive.
      if (amount <= 0) continue;
      await this.awardsRepository.save(
        this.awardsRepository.create({
          userId,
          drawDate: day,
          amount: amount.toFixed(2),
          organicArrivals,
        }),
      );
      paid += 1;
      // The draw runs at ten at night against people who are not looking. Without
      // this, a win is only ever discovered by opening the quests screen the next
      // day and noticing the balance.
      await this.notifications.notify({
        userId,
        type: NotificationType.DAILY_DRAW_WON,
        payload: { amount, drawDate: day },
      });
    }

    if (paid > 0) {
      this.logger.log(
        `Daily draw ${day}: ${paid} winner(s) of ${DRAW_SHARE} AMD out of a ${poolFor(organicArrivals)} AMD pool (${organicArrivals} organic arrivals)`,
      );
    }
    return { winners: paid, amount: paid * DRAW_SHARE, organicArrivals };
  }

  // People who registered that day with nobody's code.
  private countOrganicArrivals(day: string): Promise<number> {
    return this.usersRepository
      .createQueryBuilder('u')
      .where('u.referred_by_id IS NULL')
      .andWhere('CAST(u.created_at AS date) = :day', { day })
      .getCount();
  }

  // Everyone who opened the app that day, minus admins (the pot is theirs, so a
  // win would just move money between their own two pockets) and blocked accounts.
  // Expressed as a join rather than two round trips because the count of the same
  // set is shown to users as their odds, and the two must not be able to disagree.
  private eligibleQuery(day: string) {
    return this.checkinsRepository
      .createQueryBuilder('c')
      .innerJoin(User, 'u', 'u.id = c.user_id')
      .where('c.checkin_date = :day', { day })
      .andWhere('u.role != :admin', { admin: UserRole.ADMIN })
      .andWhere('u.banned_at IS NULL')
      .andWhere('u.deleted_at IS NULL');
  }

  private async eligibleUserIds(day: string): Promise<string[]> {
    const rows = await this.eligibleQuery(day)
      .select('c.user_id', 'userId')
      .getRawMany<{ userId: string }>();
    return rows.map((r) => r.userId);
  }

  private countEligible(day: string): Promise<number> {
    return this.eligibleQuery(day).getCount();
  }

  private static pickRandom(ids: string[], count: number): string[] {
    const pool = [...ids];
    // Fisher-Yates over just the prefix we need.
    for (let i = 0; i < Math.min(count, pool.length); i += 1) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  /**
   * One day of the draw as it concerns one person: how big the pot is, how many
   * people are in it, and what happened to them.
   *
   * Everything here is counted from rows that outlive the draw, so a past day can
   * be described without storing a summary of it. `pool` and `seats` are the
   * current rate card applied to that day's arrivals — right for today, and for
   * yesterday only until the rate changes, which is why the screen shows past
   * days by what was actually paid rather than by what was up for grabs.
   */
  async statsFor(userId: string, day: string): Promise<DrawDay> {
    const [organicArrivals, participants, winners, award, mine] = await Promise.all([
      this.countOrganicArrivals(day),
      this.countEligible(day),
      this.awardsRepository.count({ where: { drawDate: day } }),
      this.awardsRepository.findOne({ where: { userId, drawDate: day } }),
      this.checkinsRepository.count({ where: { userId, checkinDate: day } }),
    ]);

    return {
      date: day,
      organicArrivals,
      pool: poolFor(organicArrivals),
      seats: seatsFor(organicArrivals),
      participants,
      winners,
      drawn: winners > 0,
      youWon: award ? Number(award.amount) : 0,
      youIn: mine > 0,
    };
  }

  // What the quests screen shows: today's pot and odds while they can still be
  // affected, and yesterday's result — the part that makes the odds believable,
  // because a draw nobody ever sees the outcome of is indistinguishable from one
  // that never runs.
  async todayFor(userId: string) {
    const now = new Date();
    const yesterday = new Date(now.getTime());
    yesterday.setDate(yesterday.getDate() - 1);

    const [today, previous] = await Promise.all([
      this.statsFor(userId, ymd(now)),
      this.statsFor(userId, ymd(yesterday)),
    ]);

    return { share: DRAW_SHARE, perArrival: POOL_PER_ARRIVAL, today, yesterday: previous };
  }
}
