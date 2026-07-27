import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { User } from '../users/entities/user.entity';
import { RewardsService } from './rewards.service';
import { ReferralEarningsService } from '../referrals/referral-earnings.service';
import { TransactionType } from '../common/enums';
import { countStreak, ymd } from './streak';

// The engagement half of referral qualification, plus the streak reward.
@Injectable()
export class ActivityService {
  // A full streak is a week; every completed week pays out, and the first week
  // also qualifies the user's referral chain without needing a deposit.
  private static readonly STREAK_TARGET = 7;
  private static readonly STREAK_REWARD = 50;

  constructor(
    @InjectRepository(DailyCheckin)
    private readonly checkinsRepository: Repository<DailyCheckin>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rewardsService: RewardsService,
    private readonly referralEarningsService: ReferralEarningsService,
  ) {}

  // Records that the user opened the app today and returns the current streak.
  // The reward and referral-qualification fire only on the first check-in of a
  // day, so repeated calls within a day are safe and idempotent.
  async checkIn(userId: string) {
    const today = ymd(new Date());

    // Whether this is the day's first check-in decides if the reward and
    // qualification run. Read it before inserting; the insert then uses ON
    // CONFLICT DO NOTHING so a double-tap can't crash on the unique index.
    const existing = await this.checkinsRepository.findOne({ where: { userId, checkinDate: today } });
    const firstToday = !existing;
    if (firstToday) {
      await this.checkinsRepository
        .createQueryBuilder()
        .insert()
        .into(DailyCheckin)
        .values({ userId, checkinDate: today })
        .orIgnore()
        .execute();
    }

    const streak = await this.currentStreak(userId);

    let rewarded = 0;
    let qualified = false;
    if (firstToday && streak > 0 && streak % ActivityService.STREAK_TARGET === 0) {
      rewarded = await this.rewardsService.award(
        userId,
        ActivityService.STREAK_REWARD,
        `${ActivityService.STREAK_TARGET}-day streak`,
        TransactionType.QUEST_REWARD,
      );
    }
    if (firstToday && streak >= ActivityService.STREAK_TARGET) {
      // Idempotent inside — an invitee who already qualified earns no second ladder.
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (user?.referredById) {
        await this.referralEarningsService.qualifyInvitee(user, null);
        qualified = true;
      }
    }

    return {
      streak,
      target: ActivityService.STREAK_TARGET,
      rewardedToday: rewarded,
      qualifiedChain: qualified,
    };
  }

  // Read-only streak for display, without recording a visit.
  async getStreak(userId: string) {
    const streak = await this.currentStreak(userId);
    return { streak, target: ActivityService.STREAK_TARGET };
  }

  // Counts consecutive days ending today (or 0 if there's no check-in today).
  // Reads a bounded recent window rather than the whole history.
  private async currentStreak(userId: string): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const rows = await this.checkinsRepository.find({
      where: { userId, checkinDate: MoreThanOrEqual(ymd(since)) },
      select: { checkinDate: true },
    });
    return countStreak(new Set(rows.map((r) => r.checkinDate)), new Date());
  }
}
