import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionAccount, MovementKind, TransactionType } from '../common/enums';
import { lockWallet } from '../common/row-locks';
import { LedgerService, platform, userInvest } from '../ledger/ledger.service';
import { PlatformAccountService } from '../ledger/platform-account.service';

// Credits platform rewards (quests, streaks) into a user's invest credit, funded
// from the platform account — the same non-withdrawable bucket and same marketing
// pocket as referral bonuses, but paid immediately rather than held: these reward
// actions already taken, so there is nothing to claw back.
//
// The pool used to be the wallet of whichever admin account was created first,
// which made the marketing budget spendable as one person's pocket money and
// stopped every reward on the platform the moment that account was banned or
// deleted. See PlatformAccount.
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly platformAccount: PlatformAccountService,
    private readonly ledger: LedgerService,
  ) {}

  // Moves `amount` from the platform pool into the user's invest credit and
  // records both sides. Returns the amount credited, or 0 when it couldn't pay
  // (the pool is empty) — callers treat a reward as best-effort and never fail
  // the user's action over it.
  async award(
    userId: string,
    amount: number,
    reason: string,
    type = TransactionType.QUEST_REWARD,
  ): Promise<number> {
    if (amount <= 0) return 0;

    return this.dataSource.transaction(async (manager) => {
      const funded = await this.platformAccount.debit(manager, amount);
      if (!funded) {
        this.logger.warn(`Reward pool empty: cannot pay ${amount} for "${reason}"`);
        return 0;
      }

      const userWallet = await lockWallet(manager, userId);
      userWallet.investCredit = (parseFloat(userWallet.investCredit) + amount).toFixed(2);
      await manager.save(userWallet);

      const credit = await manager.save(
        manager.create(Transaction, {
          userId,
          type,
          amount: amount.toFixed(2),
          account: TransactionAccount.INVEST,
          description: reason,
        }),
      );

      // The pool's outflow no longer needs a mirrored wallet row on an admin
      // account — the movement below is both sides of it, and it names the pool
      // rather than a person who happened to be holding it.
      await this.ledger.record(manager, {
        kind:
          type === TransactionType.REFERRAL_BONUS ? MovementKind.REFERRAL_BONUS : MovementKind.REWARD,
        amount,
        from: platform(),
        to: userInvest(userId),
        transactionId: credit.id,
        description: reason,
      });

      return amount;
    });
  }
}
