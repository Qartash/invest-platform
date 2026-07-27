import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionAccount, TransactionType, UserRole } from '../common/enums';
import { lockWallets } from '../common/row-locks';

// Credits platform rewards (quests, streaks) into a user's invest credit, funded
// from the admin account — the same non-withdrawable bucket and same marketing
// pocket as referral bonuses, but paid immediately rather than held: these reward
// actions already taken, so there is nothing to claw back.
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // Moves `amount` from the admin balance into the user's invest credit and
  // records both sides. Returns the amount credited, or 0 when it couldn't pay
  // (no admin, or the pool is empty) — callers treat a reward as best-effort and
  // never fail the user's action over it.
  async award(userId: string, amount: number, reason: string, type = TransactionType.QUEST_REWARD): Promise<number> {
    if (amount <= 0) return 0;
    const admin = await this.usersRepository.findOne({
      where: { role: UserRole.ADMIN },
      order: { createdAt: 'ASC' },
    });
    if (!admin) {
      this.logger.warn(`No admin account to fund reward "${reason}" for ${userId}`);
      return 0;
    }

    return this.dataSource.transaction(async (manager) => {
      const wallets = await lockWallets(manager, [admin.id, userId]);
      const adminWallet = wallets.get(admin.id)!;
      const userWallet = wallets.get(userId)!;

      if (parseFloat(adminWallet.balance) < amount) {
        this.logger.warn(`Referral/quest pool empty: cannot pay ${amount} for "${reason}"`);
        return 0;
      }

      adminWallet.balance = (parseFloat(adminWallet.balance) - amount).toFixed(2);
      userWallet.investCredit = (parseFloat(userWallet.investCredit) + amount).toFixed(2);
      await manager.save([adminWallet, userWallet]);

      await manager.save(
        manager.create(Transaction, {
          userId,
          type,
          amount: amount.toFixed(2),
          account: TransactionAccount.INVEST,
          description: reason,
        }),
      );
      await manager.save(
        manager.create(Transaction, {
          userId: admin.id,
          type,
          amount: (-amount).toFixed(2),
          account: TransactionAccount.BALANCE,
          description: `Reward pool: ${reason}`,
        }),
      );
      return amount;
    });
  }
}
