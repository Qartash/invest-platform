import { MigrationInterface, QueryRunner } from 'typeorm';

const PLATFORM_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * The money ledger: a row for every movement with both ends named, and a real
 * account for the platform's own money.
 *
 * Written in the same shape as the referral and notification migrations and for
 * the same reasons: no transaction, and every statement safe to run twice, so a
 * half-applied run is fixed by running it again.
 *
 * The one part that is not merely additive is the pool. The rewards pool has
 * always been the wallet of the first-created admin — that is what
 * RewardsService looked up — so this moves that balance onto the platform
 * account it should have been on all along, and records the move as a movement
 * like any other. Guarded on the platform row not existing yet, which is the
 * only thing that can distinguish a first run from a second.
 */
export class MoneyLedger1786147200000 implements MigrationInterface {
  name = 'MoneyLedger1786147200000';

  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // CREATE TYPE has no IF NOT EXISTS. The names are pinned by `enumName` on the
    // entity rather than left to TypeORM's per-column default, so both ends of a
    // movement share one type — see the note on MoneyMovement.fromAccount.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "movement_kind_enum" AS ENUM (
          'deposit', 'withdrawal', 'ticket_purchase', 'ticket_resale', 'stage_release',
          'founder_withdrawal', 'project_refund', 'work_escrow_hold', 'work_payment',
          'work_escrow_return', 'dividend', 'reward', 'referral_bonus',
          'partner_settlement', 'platform_funding'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ledger_account_enum" AS ENUM (
          'external', 'platform', 'user_balance', 'user_invest',
          'project_treasury', 'project_spendable', 'work_escrow'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "money_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" "movement_kind_enum" NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'AMD',
        "from_account" "ledger_account_enum" NOT NULL,
        "from_user_id" uuid,
        "from_project_id" uuid,
        "to_account" "ledger_account_enum" NOT NULL,
        "to_user_id" uuid,
        "to_project_id" uuid,
        "work_id" uuid,
        "transaction_id" uuid,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_money_movements" PRIMARY KEY ("id")
      )
    `);

    // The panel reads "everything, newest first" and narrows that same order by
    // kind, by project or by person; none of those has an index to stand on
    // without these. No foreign keys on purpose — an audit trail must outlive
    // the account or project it refers to.
    const indexes: Array<[string, string]> = [
      ['IDX_movements_created', '"created_at"'],
      ['IDX_movements_kind_created', '"kind", "created_at"'],
      ['IDX_movements_from_user', '"from_user_id"'],
      ['IDX_movements_to_user', '"to_user_id"'],
      ['IDX_movements_from_project', '"from_project_id"'],
      ['IDX_movements_to_project', '"to_project_id"'],
    ];
    for (const [name, columns] of indexes) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "money_movements" (${columns})`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_account" (
        "id" uuid NOT NULL,
        "balance" numeric(14,2) NOT NULL DEFAULT 0,
        "currency" character varying NOT NULL DEFAULT 'AMD',
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_account" PRIMARY KEY ("id")
      )
    `);

    // Creating the row and moving the pool onto it are one step: the row's
    // absence is the only thing that tells a first run from a repeat, so a
    // version of this that inserted the row first would move the money twice.
    await queryRunner.query(`
      DO $$
      DECLARE
        admin_id uuid;
        pool numeric(14,2);
      BEGIN
        IF EXISTS (SELECT 1 FROM "platform_account" WHERE "id" = '${PLATFORM_ACCOUNT_ID}') THEN
          RETURN;
        END IF;

        INSERT INTO "platform_account" ("id", "balance", "currency")
        VALUES ('${PLATFORM_ACCOUNT_ID}', 0, 'AMD');

        SELECT u."id" INTO admin_id
          FROM "users" u
         WHERE u."role" = 'admin' AND u."deleted_at" IS NULL
         ORDER BY u."created_at" ASC
         LIMIT 1;
        IF admin_id IS NULL THEN RETURN; END IF;

        SELECT w."balance" INTO pool FROM "wallets" w WHERE w."user_id" = admin_id;
        IF pool IS NULL OR pool <= 0 THEN RETURN; END IF;

        UPDATE "wallets" SET "balance" = 0 WHERE "user_id" = admin_id;
        UPDATE "platform_account" SET "balance" = pool WHERE "id" = '${PLATFORM_ACCOUNT_ID}';

        INSERT INTO "money_movements"
          ("kind", "amount", "from_account", "from_user_id", "to_account", "description")
        VALUES
          ('platform_funding', pool, 'user_balance', admin_id, 'platform',
           'Reward pool moved off the first admin wallet onto the platform account');
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Give the pool back before dropping the account that holds it, or reverting
    // this migration would delete real money rather than move it.
    await queryRunner.query(`
      DO $$
      DECLARE
        admin_id uuid;
        pool numeric(14,2);
      BEGIN
        SELECT "balance" INTO pool FROM "platform_account" WHERE "id" = '${PLATFORM_ACCOUNT_ID}';
        IF pool IS NULL OR pool <= 0 THEN RETURN; END IF;

        SELECT u."id" INTO admin_id
          FROM "users" u
         WHERE u."role" = 'admin' AND u."deleted_at" IS NULL
         ORDER BY u."created_at" ASC
         LIMIT 1;
        IF admin_id IS NULL THEN RETURN; END IF;

        UPDATE "wallets" SET "balance" = "balance" + pool WHERE "user_id" = admin_id;
      END $$;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "platform_account"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "money_movements"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "movement_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_account_enum"`);
  }
}
