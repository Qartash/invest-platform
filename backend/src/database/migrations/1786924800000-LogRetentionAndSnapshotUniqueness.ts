import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two things the schema was not saying.
 *
 * One: a ticket has exactly one valuation on a given day. Nothing enforced it, so the
 * snapshot job run twice for the same date inserted a second copy instead of failing, and
 * the portfolio's `DISTINCT ON (ticket_id) ... ORDER BY date DESC, created_at DESC` then
 * picked between them by whichever sorted first. Any duplicates already in the table are
 * collapsed to the newest row before the constraint goes on, because a unique index cannot
 * be built over rows that violate it.
 *
 * Two: per-request logging is not a default. It writes one row — with the request body, as
 * jsonb, across four indexes — for every call the API answers, into a table that had no
 * expiry and one manual "clear everything" button for a cleanup story. The toggle stays;
 * what changes is which way it points when nobody has touched it. An admin who wants it
 * back turns it on in the Logs screen, and this migration will not run again to undo that.
 *
 * Same shape as the migrations before it: no transaction, and every statement safe to run
 * twice, because these run on every boot of the API.
 */
export class LogRetentionAndSnapshotUniqueness1786924800000 implements MigrationInterface {
  name = 'LogRetentionAndSnapshotUniqueness1786924800000';

  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Snapshot uniqueness ──────────────────────────────────────────────────

    // Keep the newest row for each (ticket, day) and drop the rest. `created_at` decides,
    // with `id` breaking the tie for rows written in the same instant — arbitrary, but
    // total, which is what matters: the point is that exactly one survives.
    await queryRunner.query(`
      DELETE FROM "earnings_snapshots" a
       USING "earnings_snapshots" b
       WHERE a."ticket_id" = b."ticket_id"
         AND a."date" = b."date"
         AND (a."created_at" < b."created_at"
              OR (a."created_at" = b."created_at" AND a."id" < b."id"))
    `);

    // Replaced rather than added alongside: the unique index serves every read the old one
    // did — same columns, same order — so keeping both would be two indexes to write on
    // every insert for one index's worth of reads.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_earnings_snapshots_ticket_date"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_earnings_snapshots_ticket_date"
         ON "earnings_snapshots" ("ticket_id", "date")`,
    );

    // ── Request logging off by default ───────────────────────────────────────

    await queryRunner.query(
      `ALTER TABLE "log_settings" ALTER COLUMN "backend_requests_enabled" SET DEFAULT false`,
    );
    // The live row too, not just the default: the settings row was created long ago, so a
    // changed default alone would leave every existing deployment logging exactly as before.
    await queryRunner.query(`UPDATE "log_settings" SET "backend_requests_enabled" = false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "log_settings" ALTER COLUMN "backend_requests_enabled" SET DEFAULT true`,
    );
    await queryRunner.query(`UPDATE "log_settings" SET "backend_requests_enabled" = true`);

    // The duplicate rows this dropped are not coming back, and nothing wants them to.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_earnings_snapshots_ticket_date"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_earnings_snapshots_ticket_date"
         ON "earnings_snapshots" ("ticket_id", "date")`,
    );
  }
}
