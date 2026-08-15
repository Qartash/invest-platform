import { MigrationInterface, QueryRunner } from 'typeorm';

// Everything the referral system, daily activity, quests and partner programme
// need on top of the pre-referral schema.
//
// Two things shape how this is written:
//
// 1. It does not run in a transaction. Postgres will not let one transaction add
//    a value to an enum and then use it, and `transactions_type_enum` gains two
//    values here. This is what made `synchronize` unusable: it failed on the
//    enum and rolled back the column additions, leaving the tables behind and
//    the columns missing.
// 2. Because there is no transaction to roll back, every statement is written to
//    be safe to run twice. A half-applied run is fixed by running it again, and
//    a database that already got this schema by hand — as the dev one did — is
//    left untouched.
export class ReferralSystem1785110400000 implements MigrationInterface {
  name = 'ReferralSystem1785110400000';

  // See note 1 above.
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The uuid defaults below need it, and a fresh database has not got it yet.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- enums -----------------------------------------------------------
    // CREATE TYPE has no IF NOT EXISTS, so each one swallows its own duplicate.
    const createEnum = (name: string, values: string[]) =>
      queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${name}" AS ENUM(${values.map((v) => `'${v}'`).join(', ')});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

    await createEnum('referral_earnings_type_enum', [
      'level_bonus',
      'deposit_percent',
    ]);
    await createEnum('referral_earnings_status_enum', [
      'pending',
      'paid',
      'cancelled',
    ]);
    await createEnum('referral_earnings_channel_enum', ['invest', 'card']);
    await createEnum('quests_scope_enum', ['platform', 'project']);
    await createEnum('quests_verification_enum', ['auto', 'client', 'admin']);
    await createEnum('partner_applications_status_enum', [
      'pending',
      'approved',
      'rejected',
      'changes_requested',
    ]);

    // Referral and quest payouts are transactions like any other, so the
    // existing type enum has to learn about them. Plain statements rather than a
    // DO block: a DO block is a transaction, and this is the statement that
    // cannot be inside one on older Postgres.
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'referral_bonus'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'quest_reward'`,
    );

    // --- users -----------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "referral_code" character varying,
        ADD COLUMN IF NOT EXISTS "referred_by_id" uuid,
        ADD COLUMN IF NOT EXISTS "referral_path" text,
        ADD COLUMN IF NOT EXISTS "partner_since" TIMESTAMP WITH TIME ZONE
    `);

    // ADD CONSTRAINT has no IF NOT EXISTS either.
    const addConstraint = (table: string, sql: string) =>
      queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}" ADD ${sql};
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL;
        END $$;
      `);

    await addConstraint(
      'users',
      `CONSTRAINT "UQ_ba10055f9ef9690e77cf6445cba" UNIQUE ("referral_code")`,
    );
    await addConstraint(
      'users',
      `CONSTRAINT "FK_a78a00605c95ca6737389f6360b" FOREIGN KEY ("referred_by_id")
         REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- referral_earnings ------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_earnings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "beneficiary_id" uuid NOT NULL,
        "source_user_id" uuid NOT NULL,
        "level" integer NOT NULL,
        "type" "public"."referral_earnings_type_enum" NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "status" "public"."referral_earnings_status_enum" NOT NULL DEFAULT 'pending',
        "channel" "public"."referral_earnings_channel_enum" NOT NULL DEFAULT 'invest',
        "matures_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "trigger_transaction_id" uuid,
        "payout_transaction_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_d5fa5a611a6f0f5d7f4907ab92b" PRIMARY KEY ("id")
      )
    `);
    // The partner programme added `channel` after the table already existed, so
    // a database created between the two still needs it.
    await queryRunner.query(`
      ALTER TABLE "referral_earnings"
        ADD COLUMN IF NOT EXISTS "channel" "public"."referral_earnings_channel_enum"
        NOT NULL DEFAULT 'invest'
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_94719a6c438e8974d6489c3121" ON "referral_earnings" ("beneficiary_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_0c496b51759a8746d57e13ac2a" ON "referral_earnings" ("source_user_id")`,
    );
    await addConstraint(
      'referral_earnings',
      `CONSTRAINT "FK_94719a6c438e8974d6489c3121b" FOREIGN KEY ("beneficiary_id")
         REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await addConstraint(
      'referral_earnings',
      `CONSTRAINT "FK_0c496b51759a8746d57e13ac2a1" FOREIGN KEY ("source_user_id")
         REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- daily_checkins ---------------------------------------------------
    // `user_id` is created as character varying with no foreign key because that
    // is what the entity described at the time — a bare column with no relation,
    // which was an oversight rather than a decision. 1785283200000 converts it to
    // uuid and adds the cascade. Left as it was here so that a database which has
    // already run this migration takes the same path as a fresh one.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_checkins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "checkin_date" date NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_8350f552c96fb4b6559283c77ec" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b64ec61f9626d0678e8c62fe16" ON "daily_checkins" ("user_id", "checkin_date")`,
    );

    // --- daily_draw_awards ------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_draw_awards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "draw_date" date NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "organic_arrivals" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c3b12ae23f1842851b51b4fbfcf" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ef2f983834f46ee01bca6a3e66" ON "daily_draw_awards" ("user_id", "draw_date")`,
    );
    await addConstraint(
      'daily_draw_awards',
      `CONSTRAINT "FK_e4152dbcb6bcada0f1c5372991c" FOREIGN KEY ("user_id")
         REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- quests -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying,
        "scope" "public"."quests_scope_enum" NOT NULL,
        "verification" "public"."quests_verification_enum" NOT NULL,
        "rule" character varying,
        "title" text,
        "description" text,
        "video_url" character varying,
        "reward" numeric(14,2) NOT NULL,
        "project_id" uuid,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_a037497017b64f530fe09c75364" PRIMARY KEY ("id")
      )
    `);
    await addConstraint(
      'quests',
      `CONSTRAINT "UQ_5fb096f5e17c59b590524d5203f" UNIQUE ("key")`,
    );
    await addConstraint(
      'quests',
      `CONSTRAINT "FK_257de7f8b719d0870feaa94dccf" FOREIGN KEY ("project_id")
         REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- quest_completions ------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quest_completions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "quest_id" uuid NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_178dfb11359cd9fcb0113e593d2" PRIMARY KEY ("id")
      )
    `);
    // This unique pair is what makes a quest pay exactly once.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_9f0eb882577b16c73b98b3d6fc" ON "quest_completions" ("user_id", "quest_id")`,
    );
    await addConstraint(
      'quest_completions',
      `CONSTRAINT "FK_8e84ae0522265db66d6d2290ce8" FOREIGN KEY ("user_id")
         REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await addConstraint(
      'quest_completions',
      `CONSTRAINT "FK_5129f91f2bcc2443e7a1e2b3ed2" FOREIGN KEY ("quest_id")
         REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- partner_applications ---------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "channel_type" character varying NOT NULL,
        "channel_url" character varying NOT NULL,
        "audience_size" integer NOT NULL,
        "topic" text NOT NULL,
        "plan" text NOT NULL,
        "status" "public"."partner_applications_status_enum" NOT NULL DEFAULT 'pending',
        "reviewer_note" text,
        "reviewed_by_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_9c52c1e24235ece37d592db8297" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_65b2a4cfd10aea5c009e0e6131" ON "partner_applications" ("user_id")`,
    );
    await addConstraint(
      'partner_applications',
      `CONSTRAINT "FK_65b2a4cfd10aea5c009e0e6131a" FOREIGN KEY ("user_id")
         REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await addConstraint(
      'partner_applications',
      `CONSTRAINT "FK_7b4199dd6d502c39847cff4dc4c" FOREIGN KEY ("reviewed_by_id")
         REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting destroys the referral ledger, every check-in streak and every
    // quest completion. It is here to make a bad deploy recoverable on a
    // database nobody has used yet, not to be run against a live one.
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quest_completions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_draw_awards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_checkins"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_earnings"`);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT IF EXISTS "FK_a78a00605c95ca6737389f6360b",
        DROP CONSTRAINT IF EXISTS "UQ_ba10055f9ef9690e77cf6445cba"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "partner_since",
        DROP COLUMN IF EXISTS "referral_path",
        DROP COLUMN IF EXISTS "referred_by_id",
        DROP COLUMN IF EXISTS "referral_code"
    `);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."partner_applications_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."quests_verification_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."quests_scope_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."referral_earnings_channel_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."referral_earnings_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."referral_earnings_type_enum"`,
    );

    // Postgres cannot drop a value from an enum, so the type is rebuilt without
    // the two. Refuse rather than destroy: if any transaction is already of one
    // of these types, dropping them would mean deleting somebody's payout
    // history, and that is not a decision a rollback gets to make quietly.
    await queryRunner.query(`
      DO $$
      DECLARE affected bigint;
      BEGIN
        SELECT count(*) INTO affected FROM "transactions"
          WHERE "type" IN ('referral_bonus', 'quest_reward');
        IF affected > 0 THEN
          RAISE EXCEPTION
            'Cannot revert: % transaction(s) are of type referral_bonus/quest_reward. Reassign or delete them first.', affected;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" RENAME TO "transactions_type_enum_old"`,
    );
    await queryRunner.query(`
      CREATE TYPE "public"."transactions_type_enum" AS ENUM(
        'buy', 'sell', 'deposit', 'withdraw', 'dividend', 'work_payment')
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions" ALTER COLUMN "type"
        TYPE "public"."transactions_type_enum"
        USING "type"::text::"public"."transactions_type_enum"
    `);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum_old"`);
  }
}
