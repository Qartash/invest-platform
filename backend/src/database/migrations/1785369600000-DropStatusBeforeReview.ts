import { MigrationInterface, QueryRunner } from 'typeorm';

// An edit to a live project used to drag the whole project into PENDING_REVIEW and
// stash the real status in `status_before_review`, to be put back on approve or
// reject. A funded project got the worst of it: the raise is finished, there is
// nothing left to pause, and a typo fix still parked it two rungs down the ladder
// in the queue beside unreviewed drafts.
//
// A live project now keeps its status and carries the proposal in
// `pending_changes`, which is what puts it in the moderation queue. That leaves
// `status_before_review` with nothing to remember.
//
// The order below is the point. Any project sitting in review *right now* is
// mid-flight across this deploy: the code that would have restored its status is
// gone, and after the drop nothing records what it was. So the rows are put back
// first and the column removed second — in one transaction, because a restore
// without the drop would be undone by the next approve, and a drop without the
// restore would silently demote a funded project to active.
export class DropStatusBeforeReview1785369600000 implements MigrationInterface {
  name = 'DropStatusBeforeReview1785369600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guarded so a database that never had the column (a fresh one built by
    // synchronize from the current entities) runs this as a no-op rather than
    // failing on the UPDATE.
    const [{ present }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects'
          AND column_name = 'status_before_review'
      ) AS present
    `);
    if (!present) return;

    // These are live projects whose only reason for being in PENDING_REVIEW was an
    // edit awaiting a decision. They go back to what they were; `pending_changes`
    // is already set on them, so they stay in the moderator's queue and the
    // decision is still there to make.
    //
    // Through text, because the two columns do not share an enum type: TypeORM
    // mints one per column, so this is projects_status_before_review_enum being
    // assigned to projects_status_enum and Postgres refuses the direct
    // assignment. The two have identical value lists, so the round trip is
    // lossless.
    await queryRunner.query(`
      UPDATE "projects"
        SET "status" = "status_before_review"::text::"projects_status_enum"
        WHERE "status" = 'pending_review'
          AND "status_before_review" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "status_before_review"`);

    // The column had its own enum type rather than sharing projects_status_enum —
    // TypeORM mints one per column. Dropping the column orphans it, and with
    // synchronize off nothing will ever come along to clean it up.
    await queryRunner.query(`DROP TYPE IF EXISTS "projects_status_before_review_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The column comes back empty. What it held was the status of edits that were
    // in flight at the moment of up(), and those projects have been restored to
    // exactly that status — so there is nothing left to put in it, and any project
    // still under review is correctly described by its own status now.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "projects_status_before_review_enum" AS ENUM
          ('draft', 'pending_review', 'active', 'funded', 'closed', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD COLUMN IF NOT EXISTS "status_before_review" "projects_status_before_review_enum"
    `);
  }
}
