import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionStatus, TransactionType } from '../common/enums';

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
  }): Promise<Transaction> {
    const transaction = this.transactionsRepository.create({
      userId: data.userId,
      type: data.type,
      amount: data.amount.toFixed(2),
      ticketId: data.ticketId ?? null,
      quantity: data.quantity ?? null,
      status: data.status ?? TransactionStatus.COMPLETED,
    });
    return this.transactionsRepository.save(transaction);
  }

  findByUser(userId: string): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
