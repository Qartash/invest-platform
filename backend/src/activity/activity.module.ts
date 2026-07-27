import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { DailyDrawAward } from './entities/daily-draw-award.entity';
import { User } from '../users/entities/user.entity';
import { ActivityService } from './activity.service';
import { RewardsService } from './rewards.service';
import { DailyDrawService } from './daily-draw.service';
import { ActivityController } from './activity.controller';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [TypeOrmModule.forFeature([DailyCheckin, DailyDrawAward, User]), ReferralsModule],
  providers: [ActivityService, RewardsService, DailyDrawService],
  controllers: [ActivityController],
  // RewardsService is exported so the quest catalog credits rewards through the
  // same admin-funded path.
  exports: [RewardsService, ActivityService],
})
export class ActivityModule {}
