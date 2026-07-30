import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { InviteEligibilityService } from './invite-eligibility.service';

// Shared by the sign-up path (which must reject a code whose owner may not invite) and the
// invites screen (which must tell that owner why their code is not working yet).
@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction])],
  providers: [InviteEligibilityService],
  exports: [InviteEligibilityService],
})
export class InviteEligibilityModule {}
