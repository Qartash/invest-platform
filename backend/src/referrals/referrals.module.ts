import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ReferralEarning } from './entities/referral-earning.entity';
import { ReferralsService } from './referrals.service';
import { ReferralEarningsService } from './referral-earnings.service';
import { ReferralsController } from './referrals.controller';
import { InviteEligibilityModule } from './invite-eligibility.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, ReferralEarning]), InviteEligibilityModule],
  providers: [ReferralsService, ReferralEarningsService],
  controllers: [ReferralsController],
  exports: [ReferralsService, ReferralEarningsService],
})
export class ReferralsModule {}
