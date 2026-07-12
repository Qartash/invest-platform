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

const LIST_PAGE_SIZE = 20;

const PERIODS: Array<{ key: keyof Omit<PeriodBreakdown, 'total'>; interval: string }> = [
  { key: 'day', interval: '1 day' },
  { key: 'week', interval: '7 days' },
  { key: 'month', interval: '30 days' },
  { key: 'year', interval: '365 days' },
];

// Time-series ranges for the Reports charts. `since`/`unit`/`step` are fixed
// literals (never user input) so they're safe to inline into SQL.
type SeriesRange = 'day' | '5day' | 'month' | 'year' | '5year' | 'max';

const SERIES_RANGES: Record<SeriesRange, { since: string | null; unit: 'hour' | 'day' | 'month'; step: string }> = {
  day: { since: '1 day', unit: 'hour', step: '1 hour' },
  '5day': { since: '5 days', unit: 'day', step: '1 day' },
  month: { since: '30 days', unit: 'day', step: '1 day' },
  year: { since: '1 year', unit: 'month', step: '1 month' },
  '5year': { since: '5 years', unit: 'month', step: '1 month' },
  max: { since: null, unit: 'month', step: '1 month' },
};

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
      this.getLatestUsers(1),
    ]);

    return {
      registered: { total, day, week, month, year } satisfies PeriodBreakdown,
      latest: latest.items,
    };
  }

  // One page of newest users, newest first, with the grand total for paging.
  async getLatestUsers(page: number) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const [items, total] = await this.usersRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
    });

    return {
      total,
      items: items.map((user) => ({
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
      this.getMoneyHistory(1),
    ]);

    // Turnover = money spent on tickets (primary sales + marketplace buys).
    return {
      turnover: toBreakdown(byType.get(TransactionType.BUY)),
      deposits: toBreakdown(byType.get(TransactionType.DEPOSIT)),
      withdrawals: toBreakdown(byType.get(TransactionType.WITHDRAW)),
      depositors,
      withdrawers,
      history: history.items,
      historyTotal: history.total,
    };
  }

  // One page of deposit/withdraw operations with the user attached, newest
  // first, plus the grand total for paging.
  async getMoneyHistory(page: number) {
    const safePage = Math.max(1, Math.floor(page) || 1);
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
       LIMIT $4 OFFSET $5`,
      [
        TransactionStatus.COMPLETED,
        TransactionType.DEPOSIT,
        TransactionType.WITHDRAW,
        LIST_PAGE_SIZE,
        (safePage - 1) * LIST_PAGE_SIZE,
      ],
    );

    const countRows: Array<{ count: string }> = await this.transactionsRepository.query(
      `SELECT COUNT(*) AS count FROM transactions WHERE status = $1 AND type IN ($2, $3)`,
      [TransactionStatus.COMPLETED, TransactionType.DEPOSIT, TransactionType.WITHDRAW],
    );

    return {
      total: parseInt(countRows[0].count, 10),
      items: rows.map((row) => ({ ...row, amount: parseFloat(row.amount) })),
    };
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

  // Time series for the Reports charts: new registrations and money moved per
  // bucket (hour/day/month depending on range). Gap buckets are filled with 0
  // via generate_series so the chart line is continuous.
  async getSeries(rangeParam: string) {
    const range: SeriesRange = (SERIES_RANGES as Record<string, unknown>)[rangeParam]
      ? (rangeParam as SeriesRange)
      : 'month';
    const { since, unit, step } = SERIES_RANGES[range];

    const start = since
      ? `date_trunc('${unit}', now() - interval '${since}')`
      : // MAX: earliest activity across users/transactions, else last month
        `date_trunc('${unit}', COALESCE(
           LEAST((SELECT MIN(created_at) FROM users), (SELECT MIN(created_at) FROM transactions)),
           now() - interval '1 month'
         ))`;

    const buckets = `WITH buckets AS (
      SELECT generate_series(${start}, date_trunc('${unit}', now()), interval '${step}') AS bucket
    )`;

    const regRows: Array<{ date: Date; value: string }> = await this.usersRepository.query(
      `${buckets}
       SELECT b.bucket AS date, COALESCE(COUNT(u.id), 0) AS value
       FROM buckets b
       LEFT JOIN users u ON date_trunc('${unit}', u.created_at) = b.bucket
       GROUP BY b.bucket
       ORDER BY b.bucket`,
    );

    const moneyRows: Array<{ date: Date; turnover: string; deposits: string; withdrawals: string }> =
      await this.transactionsRepository.query(
        `${buckets}
         SELECT b.bucket AS date,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = $1), 0) AS turnover,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = $2), 0) AS deposits,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = $3), 0) AS withdrawals
         FROM buckets b
         LEFT JOIN transactions t ON date_trunc('${unit}', t.created_at) = b.bucket AND t.status = $4
         GROUP BY b.bucket
         ORDER BY b.bucket`,
        [TransactionType.BUY, TransactionType.DEPOSIT, TransactionType.WITHDRAW, TransactionStatus.COMPLETED],
      );

    const points = (rows: Array<Record<string, any>>, key: string) =>
      rows.map((row) => ({ date: row.date, value: parseFloat(row[key]) }));

    return {
      range,
      registrations: regRows.map((row) => ({ date: row.date, value: parseInt(row.value, 10) })),
      turnover: points(moneyRows, 'turnover'),
      deposits: points(moneyRows, 'deposits'),
      withdrawals: points(moneyRows, 'withdrawals'),
    };
  }
}
