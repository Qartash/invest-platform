import { MigrationInterface, QueryRunner } from 'typeorm';

// The notifications table: one row per thing that happened, addressed to one
// person. See NotificationType for why `type` is a varchar rather than a
// Postgres enum — a list this long, and this likely to grow, is not worth an
// ALTER TYPE on every addition.
//
// Written in the same shape as the referral migration and for the same reasons:
// no transaction, and every statement safe to run twice, so a half-applied run
// is fixed by running it again.
export class Notifications1785542400000 implements MigrationInterface {
  name = 'Notifications1785542400000';

  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "payload" jsonb,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "dedupe_key" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // Both reads the app makes are "this user's, newest first" and "this user's,
    // still unread". Neither has an index to stand on without these, and the
    // unread count is asked for on every screen the bell is on.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created"
         ON "notifications" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read"
         ON "notifications" ("user_id", "read_at")`,
    );

    // ADD CONSTRAINT has no IF NOT EXISTS.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "notifications"
          ADD CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Safe to revert: the table holds notices about events, never the events
    // themselves. Everything here can be reconstructed from the ledgers it was
    // derived from — nothing depends on it.
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
