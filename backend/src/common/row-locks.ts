import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Project } from '../projects/entities/project.entity';

/**
 * Every balance on this platform is stored as a decimal string and updated by reading it,
 * doing the arithmetic in JS and writing it back. That is only safe if the row is held for
 * the whole read-modify-write, so each of these takes the row `FOR UPDATE` and every writer
 * goes through them.
 *
 * Without the lock two concurrent requests read the same balance and the second write
 * silently discards the first: ten parallel deposits of 1000 landed 2000–4000 in the wallet
 * while answering 201 to all ten, and ten parallel withdrawals of 1000 all succeeded while
 * debiting 1000 — money vanishing and money appearing from the same bug. The same race on
 * the project row handed out twelve tickets in a five-ticket project for the price of one.
 *
 * Callers must already be inside a transaction: a lock taken outside one is released
 * immediately and buys nothing.
 */
export function lockWallet(manager: EntityManager, userId: string, message = 'Wallet not found') {
  return manager
    .findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } })
    .then((wallet) => {
      if (!wallet) throw new NotFoundException(message);
      return wallet;
    });
}

/**
 * Same, for a holder who may not have a wallet row yet (a payout or a refund reaching an
 * account created before wallets existed). The new row is unlocked because nothing else can
 * reference it yet.
 */
export async function lockOrCreateWallet(manager: EntityManager, userId: string): Promise<Wallet> {
  const wallet = await manager.findOne(Wallet, {
    where: { userId },
    lock: { mode: 'pessimistic_write' },
  });
  return wallet ?? manager.create(Wallet, { userId, balance: '0', investCredit: '0', currency: 'AMD' });
}

/**
 * Locks several wallets at once — a resale touches buyer and seller, a dividend run touches
 * the founder and every holder. Always in the same (sorted) order, because two transfers
 * crossing in opposite directions would otherwise each hold what the other is waiting for
 * and deadlock.
 */
export async function lockWallets(manager: EntityManager, userIds: string[]): Promise<Map<string, Wallet>> {
  const ordered = [...new Set(userIds)].sort();
  const wallets = new Map<string, Wallet>();
  for (const userId of ordered) {
    wallets.set(userId, await lockOrCreateWallet(manager, userId));
  }
  return wallets;
}

/**
 * `ticketsSold`, `collectedAmount`, `treasuryBalance` and `spendableBalance` are read-modify-write
 * in exactly the same way as a wallet balance, so the project row needs the same treatment.
 *
 * A soft-deleted project is refused by default. Deletion only sets `deletedAt` — the row keeps
 * its `active` status and every balance it held, so a status check alone let investors keep
 * buying tickets in a project that had already vanished from the listings, paying real money
 * into an escrow nobody could reach. Deletion is checked here rather than at each call site so
 * a new money path cannot forget it; the few operations that legitimately run on a deleted
 * project — the ones that give money back — opt in explicitly.
 */
export async function lockProject(
  manager: EntityManager,
  projectId: string,
  opts: { allowDeleted?: boolean } = {},
): Promise<Project> {
  const project = await manager.findOne(Project, {
    where: { id: projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!project) throw new NotFoundException('Project not found');
  if (project.deletedAt && !opts.allowDeleted) {
    throw new ConflictException('This project has been deleted');
  }
  return project;
}
