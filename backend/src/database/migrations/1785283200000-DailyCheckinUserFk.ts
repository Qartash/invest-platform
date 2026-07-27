import { MigrationInterface, QueryRunner } from 'typeorm';

// `daily_checkins.user_id` was the one column in the referral schema that pointed
// at a user without saying so: a bare `@Column({ name: 'user_id' })` with no
// relation, which TypeORM renders as `character varying` and no foreign key. Its
// six siblings — daily_draw_awards, quest_completions, partner_applications and
// both columns of referral_earnings — are all `uuid` with ON DELETE CASCADE.
//
// The gap was not cosmetic. Check-ins survived the deletion of the user they
// belonged to, and the streak that qualifies a referral without a deposit is
// counted off exactly these rows, so orphans kept earning for an account that no
// longer existed. Joining to `users.id` also needed a cast, which no other table
// here does.
//
// Unlike 1785110400000-ReferralSystem this one keeps its transaction: it changes
// no enum, and the three steps below must not be able to land apart — dropping
// rows without then adding the constraint would be destruction for nothing.
// Statements are still written to survive a second run, both to match the
// neighbouring migration's style and because a database that already got this
// shape by hand should be left alone.
export class DailyCheckinUserFk1785283200000 implements MigrationInterface {
  name = 'DailyCheckinUserFk1785283200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1 — the orphans have to go first, or the foreign key below refuses to
    // validate and takes the whole migration with it.
    //
    // Both sides are cast to text so this reads the same whether `user_id` is
    // still varchar or has already been converted by an earlier run. That also
    // catches rows whose value was never a uuid at all — they match no user, so
    // they are swept here rather than exploding on the cast in step 2.
    //
    // This deletes data, which is the point: a check-in with no user is a row
    // nobody can reach and the streak counter should never have seen. The count
    // is reported because a surprising number is worth noticing in deploy logs.
    await queryRunner.query(`
      DO $$
      DECLARE removed bigint;
      BEGIN
        DELETE FROM "daily_checkins" dc
          WHERE NOT EXISTS (
            SELECT 1 FROM "users" u WHERE u."id"::text = dc."user_id"::text
          );
        GET DIAGNOSTICS removed = ROW_COUNT;
        IF removed > 0 THEN
          RAISE NOTICE 'daily_checkins: deleted % orphaned row(s) with no matching user', removed;
        END IF;
      END $$;
    `);

    // Step 2 — varchar to uuid. Guarded on the current type: re-running an
    // ALTER ... TYPE that changes nothing still rewrites the whole table.
    //
    // The unique index on (user_id, checkin_date) is not touched. Postgres
    // rebuilds an index over a retyped column by itself, so
    // IDX_b64ec61f9626d0678e8c62fe16 survives this and keeps a day idempotent
    // throughout; dropping and recreating it by hand would open a window where
    // two check-ins for the same day could both land.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'daily_checkins'
            AND column_name = 'user_id' AND data_type <> 'uuid'
        ) THEN
          ALTER TABLE "daily_checkins"
            ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
        END IF;
      END $$;
    `);

    // Step 3 — the constraint itself. ADD CONSTRAINT has no IF NOT EXISTS, so the
    // duplicate is swallowed the same way the referral migration does it. The
    // name is TypeORM's own for this table and column, so that a later
    // `synchronize` recognises the constraint instead of proposing to add it.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "daily_checkins"
          ADD CONSTRAINT "FK_de0d5080ef73b34487051099388" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Puts the column back the way the referral migration created it. The rows
    // deleted by up() are not coming back — nothing recorded what they were, and
    // they referenced users who had already gone.
    await queryRunner.query(`
      ALTER TABLE "daily_checkins"
        DROP CONSTRAINT IF EXISTS "FK_de0d5080ef73b34487051099388"
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'daily_checkins'
            AND column_name = 'user_id' AND data_type = 'uuid'
        ) THEN
          ALTER TABLE "daily_checkins"
            ALTER COLUMN "user_id" TYPE character varying USING "user_id"::text;
        END IF;
      END $$;
    `);
  }
}
