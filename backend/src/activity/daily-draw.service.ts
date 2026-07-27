import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { DailyDrawAward } from './entities/daily-draw-award.entity';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { User } from '../users/entities/user.entity';
import { RewardsService } from './rewards.service';
import { TransactionType, UserRole } from '../common/enums';
import { ymd } from './streak';

/**
 * The draw that replaces attributing a code-less sign-up to a random stranger.
 *
 * Someone who arrives on their own earns nobody a referral bonus — the tree only
 * ever shows real invitations. In exchange the platform puts a fixed sum up on
 * any day such arrivals happen and splits it between people who were active that
 * day. The cost is a number we choose, not one that grows with the platform, and
 * nothing about the tree is invented.
 */
@Injectable()
export class DailyDrawService {
  // The whole pot for one day, and one winner's share of it. The pot caps the
  // spend; the share caps how many people can win.
  private static readonly POOL = 2000;
  private static readonly SHARE = 100;

  private readonly logger = new Logger(DailyDrawService.name);

  constructor(
    @InjectRepository(DailyDrawAward)
    private readonly awardsRepository: Repository<DailyDrawAward>,
    @InjectRepository(DailyCheckin)
    private readonly checkinsRepository: Repository<DailyCheckin>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rewardsService: RewardsService,
  ) {}

  // Late in the day, so "active today" means most of the day has happened.
  @Cron(CronExpression.EVERY_DAY_AT_10PM)
  async runTodaysDraw(): Promise<void> {
    await this.draw(ymd(new Date()));
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

    const seats = Math.floor(DailyDrawService.POOL / DailyDrawService.SHARE);
    const winners = DailyDrawService.pickRandom(eligible, seats);

    let paid = 0;
    for (const userId of winners) {
      const amount = await this.rewardsService.award(
        userId,
        DailyDrawService.SHARE,
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
    }

    if (paid > 0) {
      this.logger.log(`Daily draw ${day}: ${paid} winner(s) of ${DailyDrawService.SHARE} AMD (${organicArrivals} organic arrivals)`);
    }
    return { winners: paid, amount: paid * DailyDrawService.SHARE, organicArrivals };
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
  private async eligibleUserIds(day: string): Promise<string[]> {
    const rows = await this.checkinsRepository.find({ where: { checkinDate: day }, select: { userId: true } });
    if (rows.length === 0) return [];
    const users = await this.usersRepository.find({
      where: {
        id: In(rows.map((r) => r.userId)),
        role: Not(UserRole.ADMIN),
        bannedAt: IsNull(),
        deletedAt: IsNull(),
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
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

  // What today's draw did for one person, for the card on the quests screen.
  async todayFor(userId: string) {
    const day = ymd(new Date());
    const award = await this.awardsRepository.findOne({ where: { userId, drawDate: day } });
    return {
      pool: DailyDrawService.POOL,
      share: DailyDrawService.SHARE,
      wonToday: award ? Number(award.amount) : 0,
      organicArrivals: award?.organicArrivals ?? 0,
    };
  }
}
