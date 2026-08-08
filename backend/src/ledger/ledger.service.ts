import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MoneyMovement } from './entities/money-movement.entity';
import { LedgerAccount, MovementKind } from '../common/enums';

/** One end of a movement: which kind of account, and whose. */
export interface LedgerEnd {
  account: LedgerAccount;
  userId?: string | null;
  projectId?: string | null;
}

export interface MovementInput {
  kind: MovementKind;
  amount: number;
  from: LedgerEnd;
  to: LedgerEnd;
  workId?: string | null;
  transactionId?: string | null;
  description?: string | null;
}

/** Shorthands so call sites read as the movement they describe. */
export const external = (): LedgerEnd => ({ account: LedgerAccount.EXTERNAL });
export const platform = (): LedgerEnd => ({ account: LedgerAccount.PLATFORM });
export const userBalance = (userId: string): LedgerEnd => ({
  account: LedgerAccount.USER_BALANCE,
  userId,
});
export const userInvest = (userId: string): LedgerEnd => ({
  account: LedgerAccount.USER_INVEST,
  userId,
});
export const projectTreasury = (projectId: string): LedgerEnd => ({
  account: LedgerAccount.PROJECT_TREASURY,
  projectId,
});
export const projectSpendable = (projectId: string): LedgerEnd => ({
  account: LedgerAccount.PROJECT_SPENDABLE,
  projectId,
});
export const workEscrow = (projectId: string): LedgerEnd => ({
  account: LedgerAccount.WORK_ESCROW,
  projectId,
});

/**
 * Writes the ledger.
 *
 * Every method takes the caller's `EntityManager` rather than opening its own
 * transaction, and that is the whole point: a movement is written by the same
 * database transaction that moved the balance, so the two commit together or
 * neither does. A ledger that can be a row short of the truth is worse than no
 * ledger, because it is the thing people will reconcile against.
 */
@Injectable()
export class LedgerService {
  async record(manager: EntityManager, input: MovementInput): Promise<MoneyMovement | null> {
    // Zero-value movements are noise, not history — a payout run that rounds a
    // holder's share down to nothing did not move anything.
    if (!(input.amount > 0)) return null;

    return manager.save(
      manager.create(MoneyMovement, {
        kind: input.kind,
        amount: input.amount.toFixed(2),
        fromAccount: input.from.account,
        fromUserId: input.from.userId ?? null,
        fromProjectId: input.from.projectId ?? null,
        toAccount: input.to.account,
        toUserId: input.to.userId ?? null,
        toProjectId: input.to.projectId ?? null,
        workId: input.workId ?? null,
        transactionId: input.transactionId ?? null,
        description: input.description ?? null,
      }),
    );
  }

  /** Records several movements in order. Same transaction, same guarantees. */
  async recordMany(manager: EntityManager, inputs: MovementInput[]): Promise<void> {
    for (const input of inputs) {
      await this.record(manager, input);
    }
  }
}
