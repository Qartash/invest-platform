import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionAccount, TransactionStatus, TransactionType } from '../common/enums';

// Lifetime figures for one account: what was ever put in, what was ever taken
// out, and how much invest credit was ever granted.
export interface TransactionTotals {
  deposited: number;
  withdrawn: number;
  investCredited: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  record(data: {
    userId: string;
    type: TransactionType;
    amount: number;
    ticketId?: string | null;
    quantity?: number | null;
    status?: TransactionStatus;
    description?: string | null;
    account?: TransactionAccount | null;
  }): Promise<Transaction> {
    const transaction = this.transactionsRepository.create({
      userId: data.userId,
      type: data.type,
      amount: data.amount.toFixed(2),
      ticketId: data.ticketId ?? null,
      quantity: data.quantity ?? null,
      status: data.status ?? TransactionStatus.COMPLETED,
      description: data.description ?? null,
      account: data.account ?? null,
    });
    return this.transactionsRepository.save(transaction);
  }

  // Paged rather than everything-at-once: a long-standing account's history is
  // hundreds of rows, and the screen only ever shows a handful. `total` comes back
  // so the caller can say which page of how many it is on, and `totals` so the
  // lifetime figures don't change depending on which page happens to be open.
  async findByUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): Promise<{
    items: Transaction[];
    total: number;
    page: number;
    pageSize: number;
    totals: TransactionTotals;
  }> {
    const [[items, total], totals] = await Promise.all([
      this.transactionsRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.totalsByUser(userId),
    ]);
    return { items, total, page, pageSize, totals };
  }

  // Lifetime sums, counted over the whole ledger rather than the page on screen.
  //
  // Invest credit is summed by account rather than by type: it is granted by a
  // referral bonus, a quest reward and a work payment taken in tickets, and those
  // three are the only rows that carry `account = 'invest'` — buying and selling
  // tickets leaves `account` null, so spending credit can't cancel out the grants.
  // That makes this "how much was ever credited", which is deliberately not the
  // same number as the credit left in the wallet.
  //
  // Only completed rows count; a failed withdrawal is not money that left.
  async totalsByUser(userId: string): Promise<TransactionTotals> {
    const raw = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount) FILTER (WHERE t.type = :deposit), 0)', 'deposited')
      .addSelect('COALESCE(SUM(t.amount) FILTER (WHERE t.type = :withdraw), 0)', 'withdrawn')
      .addSelect('COALESCE(SUM(t.amount) FILTER (WHERE t.account = :invest), 0)', 'investCredited')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .setParameters({
        deposit: TransactionType.DEPOSIT,
        withdraw: TransactionType.WITHDRAW,
        invest: TransactionAccount.INVEST,
        status: TransactionStatus.COMPLETED,
        userId,
      })
      .getRawOne<{ deposited: string; withdrawn: string; investCredited: string }>();

    return {
      deposited: parseFloat(raw?.deposited ?? '0'),
      withdrawn: parseFloat(raw?.withdrawn ?? '0'),
      investCredited: parseFloat(raw?.investCredited ?? '0'),
    };
  }
}
