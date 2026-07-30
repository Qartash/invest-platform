import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus, TransactionType } from '../common/enums';
import { InviteEligibility, inviteEligibility } from './invite-eligibility';

/**
 * Answers "may this account invite anyone?" — see invite-eligibility.ts for the rule itself.
 *
 * Deliberately its own tiny provider rather than a method on ReferralsService: the sign-up
 * path has to ask the same question, and pulling the whole referrals surface into AuthModule
 * to get at one predicate is how a module graph turns into a knot.
 */
@Injectable()
export class InviteEligibilityService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Transaction) private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  async forUser(user: User): Promise<InviteEligibility> {
    // Any completed deposit, ever — the rule is "has put money in", not "holds a balance".
    // Someone who deposited and then spent it all on tickets has done the thing being asked.
    const deposits = await this.transactionsRepository.count({
      where: { userId: user.id, type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED },
    });
    return inviteEligibility({
      role: user.role,
      partnerSince: user.partnerSince,
      createdAt: user.createdAt,
      hasDeposited: deposits > 0,
    });
  }

  async forUserId(userId: string): Promise<InviteEligibility | null> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    return user ? this.forUser(user) : null;
  }
}
