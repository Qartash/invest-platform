import { MigrationInterface, QueryRunner } from 'typeorm';

// The portfolio screen is the slowest thing in the app, and the queries behind it had
// no index to stand on. Postgres does not index a foreign key column of its own accord
// — the constraint is not an index — so each of these was a sequential scan of the
// whole table, every time the screen opened:
//
//   tickets by owner_id                      the holdings themselves
//   earnings_snapshots by (ticket_id, date)  the valuation of each held ticket
//   report_payouts by user_id                dividends this user has been paid
//
// report_payouts does carry a unique index on (report_id, user_id), but user_id is the
// second column there and a filter on it alone cannot use that index.
//
// Each one is also declared as @Index on its entity, under the same name written here.
// That is not belt and braces: an index in the database that no entity claims is one
// synchronize deletes, so leaving them out of the entities would have a local boot
// quietly undo this migration — and would fail the entities-match-schema phase of
// `npm run migration:verify`.
export class PortfolioLookupIndexes1785456000000 implements MigrationInterface {
  name = 'PortfolioLookupIndexes1785456000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Not CONCURRENTLY, which cannot run inside a transaction and so cannot run inside
    // a TypeORM migration. The plain form takes a lock that blocks writes for as long
    // as the build takes, which is fine here: migrations run from the start command,
    // before the process begins serving anything.

    // Ascending on date, though the query that leans on it wants each ticket's newest
    // valuation first. A descending index would save that sort, but @Index cannot
    // express a direction, and an index the entity cannot describe is one synchronize
    // would drop. The sort it costs runs over one investor's snapshots; the sequential
    // scan it saves runs over every snapshot ever taken.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_earnings_snapshots_ticket_date"
         ON "earnings_snapshots" ("ticket_id", "date")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_owner" ON "tickets" ("owner_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_report_payouts_user" ON "report_payouts" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_payouts_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_owner"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_earnings_snapshots_ticket_date"`);
  }
}
