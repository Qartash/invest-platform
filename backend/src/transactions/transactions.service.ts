import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionAccount, TransactionStatus, TransactionType } from '../common/enums';

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
  // so the caller can say which page of how many it is on.
  async findByUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number }> {
    const [items, total] = await this.transactionsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }
}
