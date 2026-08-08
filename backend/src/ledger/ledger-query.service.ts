import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoneyMovement } from './entities/money-movement.entity';
import { PLATFORM_ACCOUNT_ID } from './entities/platform-account.entity';
import { LedgerAccount, MovementKind } from '../common/enums';

const PAGE_SIZE = 25;

/**
 * The read side of the ledger — everything the moderation finance panel shows.
 *
 * Raw SQL rather than the query builder because both answers are aggregates
 * across tables the ledger has no relations to: movements reference users and
 * projects by id and on purpose carry no foreign keys, so the names have to be
 * joined on by hand.
 */
@Injectable()
export class LedgerQueryService {
  constructor(
    @InjectRepository(MoneyMovement)
    private readonly movements: Repository<MoneyMovement>,
  ) {}

  /**
   * Where every currency unit on the platform is sitting right now, against how
   * much of it the ledger can account for.
   *
   * `unaccounted` is the honest part. Money that was on the platform before the
   * ledger existed has no movement behind it, so it shows up here as a balance
   * with no recorded source. It should fall to zero only as the old balances are
   * spent; anything that makes it grow after this shipped is a movement someone
   * forgot to record.
   */
  async summary() {
    const [balances, flows, firstRow] = await Promise.all([
      this.movements.query(`
        SELECT
          COALESCE((SELECT SUM(balance) FROM platform_account WHERE id = $1), 0) AS "platform",
          COALESCE((SELECT SUM(balance) FROM wallets), 0)                        AS "userBalances",
          COALESCE((SELECT SUM(invest_credit) FROM wallets), 0)                  AS "userInvest",
          COALESCE((SELECT SUM(treasury_balance) FROM projects
                     WHERE deleted_at IS NULL), 0)                               AS "projectTreasuries",
          COALESCE((SELECT SUM(spendable_balance) FROM projects
                     WHERE deleted_at IS NULL), 0)                               AS "projectSpendable",
          COALESCE((SELECT SUM(escrow_amount) FROM project_works
                     WHERE escrow_amount IS NOT NULL), 0)                        AS "workEscrow"
      `, [PLATFORM_ACCOUNT_ID]),
      this.movements.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE from_account = $1), 0) AS "emittedIn",
           COALESCE(SUM(amount) FILTER (WHERE to_account = $1), 0)   AS "emittedOut",
           COUNT(*)                                                  AS "movements"
         FROM money_movements`,
        [LedgerAccount.EXTERNAL],
      ),
      this.movements.query(`SELECT MIN(created_at) AS "since" FROM money_movements`),
    ]);

    const b = balances[0];
    const f = flows[0];
    const num = (v: unknown) => parseFloat(String(v ?? '0'));

    const held =
      num(b.platform) +
      num(b.userBalances) +
      num(b.userInvest) +
      num(b.projectTreasuries) +
      num(b.projectSpendable) +
      num(b.workEscrow);
    const netEmitted = num(f.emittedIn) - num(f.emittedOut);

    return {
      platform: num(b.platform),
      userBalances: num(b.userBalances),
      userInvest: num(b.userInvest),
      projectTreasuries: num(b.projectTreasuries),
      projectSpendable: num(b.projectSpendable),
      workEscrow: num(b.workEscrow),
      held: Math.round(held * 100) / 100,
      emittedIn: num(f.emittedIn),
      emittedOut: num(f.emittedOut),
      netEmitted: Math.round(netEmitted * 100) / 100,
      unaccounted: Math.round((held - netEmitted) * 100) / 100,
      movements: parseInt(String(f.movements ?? '0'), 10),
      since: firstRow[0]?.since ?? null,
    };
  }

  /**
   * One page of movements, newest first, with both ends resolved to something
   * readable. Filters are optional and combine.
   */
  async feed(options: { page?: number; kind?: MovementKind; projectId?: string; userId?: string }) {
    const page = Math.max(1, Math.floor(options.page ?? 1) || 1);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.kind) {
      params.push(options.kind);
      conditions.push(`m.kind = $${params.length}`);
    }
    if (options.projectId) {
      params.push(options.projectId);
      conditions.push(`(m.from_project_id = $${params.length} OR m.to_project_id = $${params.length})`);
    }
    if (options.userId) {
      params.push(options.userId);
      conditions.push(`(m.from_user_id = $${params.length} OR m.to_user_id = $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await this.movements.query(
      `SELECT COUNT(*) AS count FROM money_movements m ${where}`,
      params,
    );
    const total = parseInt(String(countRows[0]?.count ?? '0'), 10);

    const rows = await this.movements.query(
      `SELECT m.id,
              m.kind,
              m.amount,
              m.from_account   AS "fromAccount",
              m.from_user_id   AS "fromUserId",
              m.from_project_id AS "fromProjectId",
              m.to_account     AS "toAccount",
              m.to_user_id     AS "toUserId",
              m.to_project_id  AS "toProjectId",
              m.work_id        AS "workId",
              m.description,
              m.created_at     AS "createdAt",
              fu."fullName"    AS "fromUserName",
              fu.username      AS "fromUsername",
              tu."fullName"    AS "toUserName",
              tu.username      AS "toUsername",
              fp.title         AS "fromProjectTitle",
              tp.title         AS "toProjectTitle"
         FROM money_movements m
         LEFT JOIN users fu    ON fu.id = m.from_user_id
         LEFT JOIN users tu    ON tu.id = m.to_user_id
         LEFT JOIN projects fp ON fp.id = m.from_project_id
         LEFT JOIN projects tp ON tp.id = m.to_project_id
         ${where}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params,
    );

    return {
      total,
      page,
      pageSize: PAGE_SIZE,
      items: rows.map((row: Record<string, unknown>) => ({
        ...row,
        amount: parseFloat(String(row.amount)),
      })),
    };
  }

  /** Totals per kind, so the panel can say what the money was actually spent on. */
  async byKind() {
    const rows = await this.movements.query(
      `SELECT kind, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM money_movements
        GROUP BY kind
        ORDER BY SUM(amount) DESC`,
    );
    return rows.map((row: { kind: string; total: string; count: string }) => ({
      kind: row.kind,
      total: parseFloat(row.total),
      count: parseInt(row.count, 10),
    }));
  }
}
