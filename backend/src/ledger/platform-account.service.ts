import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PLATFORM_ACCOUNT_ID, PlatformAccount } from './entities/platform-account.entity';

/**
 * The platform's own balance — the pool behind every reward, streak bonus, draw
 * prize and referral bonus.
 *
 * Locked FOR UPDATE for the whole read-modify-write, exactly like a wallet: the
 * pool is drawn on by an hourly referral job, a nightly draw and every quest
 * anyone completes, so it has more concurrent writers than most wallets ever
 * see. See row-locks.ts for what goes wrong without the lock.
 */
@Injectable()
export class PlatformAccountService {
  constructor(
    @InjectRepository(PlatformAccount)
    private readonly accounts: Repository<PlatformAccount>,
  ) {}

  /**
   * The row, held for update. Created on the spot if it is missing so a database
   * that came up through `synchronize` rather than the migration still has a
   * pool — an empty one, which the panel shows and the existing
   * "pool is empty" notice already warns about.
   */
  private async lock(manager: EntityManager): Promise<PlatformAccount> {
    const existing = await manager.findOne(PlatformAccount, {
      where: { id: PLATFORM_ACCOUNT_ID },
      lock: { mode: 'pessimistic_write' },
    });
    if (existing) return existing;
    return manager.save(
      manager.create(PlatformAccount, { id: PLATFORM_ACCOUNT_ID, balance: '0', currency: 'AMD' }),
    );
  }

  /**
   * Takes `amount` out of the pool, or returns false if it cannot cover it.
   *
   * Returning false rather than throwing is deliberate and matches what the
   * callers already do: a reward is best-effort, and an empty pool must leave
   * the user's action — completing a quest, checking in — succeeding rather than
   * failing on the platform's own accounting.
   */
  async debit(manager: EntityManager, amount: number): Promise<boolean> {
    if (!(amount > 0)) return false;
    const account = await this.lock(manager);
    const balance = parseFloat(account.balance);
    if (balance < amount) return false;
    account.balance = (balance - amount).toFixed(2);
    await manager.save(account);
    return true;
  }

  /**
   * Puts money into the pool and returns what it holds afterwards — read off the
   * locked row rather than re-queried, because a fresh read from outside the
   * caller's transaction would not see the credit that just happened.
   */
  async credit(manager: EntityManager, amount: number): Promise<number> {
    const account = await this.lock(manager);
    if (amount > 0) {
      account.balance = (parseFloat(account.balance) + amount).toFixed(2);
      await manager.save(account);
    }
    return parseFloat(account.balance);
  }

  /** Read-only, for the panel. No lock: a figure on a screen, not a decision. */
  async balance(): Promise<number> {
    const account = await this.accounts.findOne({ where: { id: PLATFORM_ACCOUNT_ID } });
    return account ? parseFloat(account.balance) : 0;
  }
}
