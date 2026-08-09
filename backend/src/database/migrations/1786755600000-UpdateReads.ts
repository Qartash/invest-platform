import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One row per person per post, so `project_updates.read_count` counts readers
 * rather than page loads.
 *
 * The counter shipped as a bare increment on every request for the newest post
 * on the screen. That made it wrong in both directions at once: a founder
 * opening their own feed nine times drove the top post to "read by 9" on a
 * project with two investors, while every post below it stayed at zero because
 * nothing ever reported them. A founder reads this number to decide whether
 * anyone is listening, so it has to mean people.
 *
 * `read_count` is reset here rather than reconstructed — there is nothing to
 * reconstruct it from, and a leftover inflated number is worse than starting
 * the count honestly from the day the table exists.
 */
export class UpdateReads1786755600000 implements MigrationInterface {
  name = 'UpdateReads1786755600000';

  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_update_reads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "update_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_update_reads" PRIMARY KEY ("id")
      )
    `);

    // The whole point of the table: a second visit by the same person is
    // rejected here and increments nothing.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_project_update_reads_update_user"
         ON "project_update_reads" ("update_id", "user_id")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "project_update_reads"
          ADD CONSTRAINT "FK_project_update_reads_update" FOREIGN KEY ("update_id")
          REFERENCES "project_updates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "project_update_reads"
          ADD CONSTRAINT "FK_project_update_reads_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL;
      END $$;
    `);

    // Safe to run twice: with the table in place every count is derivable from
    // it, so this settles on the same answer however many times it runs.
    await queryRunner.query(`
      UPDATE "project_updates" u
         SET "read_count" = COALESCE((
           SELECT count(*) FROM "project_update_reads" r WHERE r."update_id" = u."id"
         ), 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_update_reads"`);
  }
}
