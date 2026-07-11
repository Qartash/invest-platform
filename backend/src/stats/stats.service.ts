import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus, TransactionType } from '../common/enums';

export interface PeriodBreakdown {
  total: number;
  day: number;
  week: number;
  month: number;
  year: number;
}

const PERIODS: Array<{ key: keyof Omit<PeriodBreakdown, 'total'>; interval: string }> = [
  { key: 'day', interval: '1 day' },
  { key: 'week', interval: '7 days' },
  { key: 'month', interval: '30 days' },
  { key: 'year', interval: '365 days' },
];

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  async getUsersStats() {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);

    const [total, day, week, month, year, latest] = await Promise.all([
      this.usersRepository.count(),
      this.usersRepository.count({ where: { createdAt: MoreThanOrEqual(since(1)) } }),
      this.usersRepository.count({ where: { createdAt: MoreThanOrEqual(since(7)) } }),
      this.usersRepository.count({ where: { createdAt: MoreThanOrEqual(since(30)) } }),
      this.usersRepository.count({ where: { createdAt: MoreThanOrEqual(since(365)) } }),
      this.usersRepository.find({ order: { createdAt: 'DESC' }, take: 15 }),
    ]);

    return {
      registered: { total, day, week, month, year } satisfies PeriodBreakdown,
      latest: latest.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        avatarEmoji: user.avatarEmoji,
        role: user.role,
        createdAt: user.createdAt,
      })),
    };
  }

  async getMoneyStats() {
    // One row per transaction type with SUM per period via FILTER — a single
    // pass over the table instead of 15 separate aggregate queries.
    const filters = PERIODS.map(
      ({ key, interval }) =>
        `COALESCE(SUM(amount) FILTER (WHERE created_at >= now() - interval '${interval}'), 0) AS "${key}"`,
    ).join(', ');

    const rows: Array<{ type: string; total: string; day: string; week: string; month: string; year: string }> =
      await this.transactionsRepository.query(
        `SELECT type, COALESCE(SUM(amount), 0) AS total, ${filters}
         FROM transactions
         WHERE status = $1
         GROUP BY type`,
        [TransactionStatus.COMPLETED],
      );

    const empty = (): PeriodBreakdown => ({ total: 0, day: 0, week: 0, month: 0, year: 0 });
    const toBreakdown = (row?: (typeof rows)[number]): PeriodBreakdown =>
      row
        ? {
            total: parseFloat(row.total),
            day: parseFloat(row.day),
            week: parseFloat(row.week),
            month: parseFloat(row.month),
            year: parseFloat(row.year),
          }
        : empty();

    const byType = new Map(rows.map((row) => [row.type, row]));

    const [depositors, withdrawers, history] = await Promise.all([
      this.sumByUser(TransactionType.DEPOSIT),
      this.sumByUser(TransactionType.WITHDRAW),
      this.getMoneyHistory(),
    ]);

    // Turnover = money spent on tickets (primary sales + marketplace buys).
    return {
      turnover: toBreakdown(byType.get(TransactionType.BUY)),
      deposits: toBreakdown(byType.get(TransactionType.DEPOSIT)),
      withdrawals: toBreakdown(byType.get(TransactionType.WITHDRAW)),
      depositors,
      withdrawers,
      history,
    };
  }

  // Latest deposit/withdraw operations with the user attached, newest first.
  private async getMoneyHistory() {
    const rows: Array<{
      id: string;
      type: string;
      amount: string;
      createdAt: Date;
      userId: string;
      fullName: string | null;
      username: string | null;
      avatarUrl: string | null;
      avatarEmoji: string | null;
    }> = await this.transactionsRepository.query(
      `SELECT t.id,
              t.type,
              t.amount,
              t.created_at AS "createdAt",
              u.id AS "userId",
              u."fullName",
              u.username,
              u.avatar_url AS "avatarUrl",
              u.avatar_emoji AS "avatarEmoji"
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.status = $1 AND t.type IN ($2, $3)
       ORDER BY t.created_at DESC
       LIMIT 100`,
      [TransactionStatus.COMPLETED, TransactionType.DEPOSIT, TransactionType.WITHDRAW],
    );

    return rows.map((row) => ({ ...row, amount: parseFloat(row.amount) }));
  }

  // Per-user totals for one transaction type, biggest first.
  private async sumByUser(type: TransactionType) {
    const rows: Array<{
      id: string;
      fullName: string | null;
      username: string | null;
      avatarUrl: string | null;
      avatarEmoji: string | null;
      amount: string;
      count: string;
    }> = await this.transactionsRepository.query(
      `SELECT u.id,
              u."fullName",
              u.username,
              u.avatar_url AS "avatarUrl",
              u.avatar_emoji AS "avatarEmoji",
              SUM(t.amount) AS amount,
              COUNT(*) AS count
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.status = $1 AND t.type = $2
       GROUP BY u.id
       ORDER BY SUM(t.amount) DESC
       LIMIT 20`,
      [TransactionStatus.COMPLETED, type],
    );

    return rows.map((row) => ({
      ...row,
      amount: parseFloat(row.amount),
      count: parseInt(row.count, 10),
    }));
  }
}
