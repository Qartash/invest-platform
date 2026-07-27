/**
 * Proves the schema migrations against a throwaway local Postgres, because the
 * only other database we have is the hosted one the staging API serves from.
 *
 * The trick is that we have no copy of the old schema to migrate from, so this
 * builds the current one with `synchronize`, winds it back with the migration's
 * own `down()`, and then migrates forward again — after which the schema has to
 * match the entities exactly, or the migration and the entities disagree.
 *
 * Phase 6 covers the daily_checkins foreign key separately, because unlike the
 * referral migration that one has to cope with rows that are already there: it
 * deletes check-ins whose user is gone before it can add the constraint, and
 * "deletes rows" is worth proving rather than assuming.
 *
 * Run `docker compose up -d postgres` first, then `npm run migration:verify`.
 * Connection details are hardcoded to the docker-compose service and .env.local
 * is deliberately never read: it points at the hosted database.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { ReferralSystem1785110400000 } from './migrations/1785110400000-ReferralSystem';
import { DailyCheckinUserFk1785283200000 } from './migrations/1785283200000-DailyCheckinUserFk';

const LOCAL = {
  type: 'postgres' as const,
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'migration_test',
};

const entities = [join(__dirname, '..', '**', '*.entity.ts')];
const migrations = [join(__dirname, 'migrations', '*.ts')];

const REFERRAL_TABLES = [
  'referral_earnings',
  'daily_checkins',
  'daily_draw_awards',
  'quests',
  'quest_completions',
  'partner_applications',
];

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(
    `${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` :: ${detail}` : ''}`,
  );
  if (!ok) failures++;
}

// Raw SQL comes back untyped. Everything below goes through `rows`, which names
// the shape once per query, so the rest of the file reads as ordinary typed code
// instead of scattering `any` through every check.
//
// Both DataSource and QueryRunner satisfy this, which is what lets phase 6 reuse
// the probes on a connection that is mid-experiment.
type Q = { query(sql: string, params?: unknown[]): Promise<unknown> };

const rows = async <T>(q: Q, sql: string, params?: unknown[]): Promise<T[]> =>
  (await q.query(sql, params)) as T[];

// pg returns count() as a string, since bigint does not fit a JS number.
const countOf = async (
  q: Q,
  sql: string,
  params?: unknown[],
): Promise<number> =>
  Number((await rows<{ count: string }>(q, sql, params))[0].count);

// Several checks below assert on the text of a failure they provoked on purpose.
const msg = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const tablesPresent = async (q: Q): Promise<string[]> =>
  (
    await rows<{ table_name: string }>(
      q,
      `select table_name from information_schema.tables where table_schema='public'`,
    )
  ).map((r) => r.table_name);

const txEnumValues = async (q: Q): Promise<string[]> =>
  (
    await rows<{ enumlabel: string }>(
      q,
      `select e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid
       where t.typname='transactions_type_enum' order by e.enumsortorder`,
    )
  ).map((r) => r.enumlabel);

const userCols = async (q: Q): Promise<string[]> =>
  (
    await rows<{ column_name: string }>(
      q,
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='users'
         and column_name in ('referral_code','referred_by_id','referral_path','partner_since')`,
    )
  ).map((r) => r.column_name);

// --- daily_checkins.user_id probes ------------------------------------------
const columnType = async (
  q: Q,
  table: string,
  column: string,
): Promise<string> => {
  const found = await rows<{ data_type: string }>(
    q,
    `select data_type from information_schema.columns
     where table_schema='public' and table_name=$1 and column_name=$2`,
    [table, column],
  );
  return found[0]?.data_type ?? '(missing)';
};

// The delete rule comes back too: a foreign key that is not ON DELETE CASCADE
// would still leave the orphan problem, just with a louder failure.
const foreignKeyRule = async (
  q: Q,
  table: string,
  column: string,
): Promise<string> => {
  const found = await rows<{ delete_rule: string; target: string }>(
    q,
    `select rc.delete_rule, ccu.table_name as target
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name
     join information_schema.referential_constraints rc
       on rc.constraint_name = tc.constraint_name
     join information_schema.constraint_column_usage ccu
       on ccu.constraint_name = tc.constraint_name
     where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'
       and tc.table_name=$1 and kcu.column_name=$2`,
    [table, column],
  );
  return found[0] ? `${found[0].target}:${found[0].delete_rule}` : '(no fk)';
};

const indexNames = async (q: Q, table: string): Promise<string[]> =>
  (
    await rows<{ indexname: string }>(
      q,
      `select indexname from pg_indexes where schemaname='public' and tablename=$1`,
      [table],
    )
  ).map((r) => r.indexname);

// The unique pair is what makes a day idempotent, so the check is that some
// unique index still covers exactly (user_id, checkin_date) — whatever it is
// called — alongside the separate check that the known name survived.
const hasUniqueCheckinPair = async (q: Q): Promise<boolean> =>
  (
    await rows<{ relname: string }>(
      q,
      `select i.relname from pg_class t
       join pg_index ix on ix.indrelid = t.oid
       join pg_class i on i.oid = ix.indexrelid
       where t.relname='daily_checkins' and ix.indisunique
         and (select array_agg(a.attname::text order by a.attname)
              from pg_attribute a
              where a.attrelid=t.oid and a.attnum = any(ix.indkey))
             = array['checkin_date','user_id']`,
    )
  ).length > 0;

(async () => {
  // ---- phase 0: fresh database ----------------------------------------
  const admin = new DataSource({ ...LOCAL, database: 'postgres' });
  await admin.initialize();
  await admin.query(`DROP DATABASE IF EXISTS migration_test`);
  await admin.query(`CREATE DATABASE migration_test`);
  await admin.destroy();
  console.log('\n[0] fresh database created');

  // ---- phase 1: build the full current schema with synchronize --------
  const sync = new DataSource({
    ...LOCAL,
    entities,
    synchronize: true,
    logging: ['error'],
  });
  await sync.initialize();
  console.log('[1] synchronize built the full schema');
  {
    const t = await tablesPresent(sync);
    check(
      'all referral tables exist after sync',
      REFERRAL_TABLES.every((x) => t.includes(x)),
    );
    const vals = await txEnumValues(sync);
    check(
      'tx enum has the two new values',
      ['referral_bonus', 'quest_reward'].every((v) => vals.includes(v)),
      vals.join(','),
    );
  }

  // ---- phase 2: roll back to the pre-referral schema via down() -------
  const migration = new ReferralSystem1785110400000();
  const qr = sync.createQueryRunner();
  await qr.connect();
  await migration.down(qr);
  console.log('[2] migration.down() applied — schema is now "pre-referral"');
  {
    const t = await tablesPresent(sync);
    check(
      'referral tables removed',
      REFERRAL_TABLES.every((x) => !t.includes(x)),
      REFERRAL_TABLES.filter((x) => t.includes(x)).join(',') || 'none left',
    );
    const cols = await userCols(sync);
    check(
      'users referral columns removed',
      cols.length === 0,
      cols.join(',') || 'none left',
    );
    const vals = await txEnumValues(sync);
    check(
      'tx enum back to 6 values',
      vals.length === 6 && !vals.includes('referral_bonus'),
      vals.join(','),
    );
  }
  await qr.release();
  await sync.destroy();

  // ---- phase 3: run the migration the way a deploy would --------------
  const mig = new DataSource({
    ...LOCAL,
    entities,
    migrations,
    synchronize: false,
    migrationsTransactionMode: 'each' as const,
    logging: ['error'],
  });
  await mig.initialize();
  const ran = await mig.runMigrations();
  console.log(
    `[3] runMigrations() applied: ${ran.map((m) => m.name).join(', ') || '(none)'}`,
  );
  // Named rather than counted. This asked for `ran.length === 2` and went stale the
  // moment a third migration landed, failing the run for no reason anyone had to act
  // on. Phase 2 winds back exactly these two, so exactly these two are what has to come
  // forward again; every later migration is free to arrive without touching this line.
  const ranNames = ran.map((m) => m.name);
  check(
    'the migrations phase 2 reverted ran again',
    [ReferralSystem1785110400000.name, DailyCheckinUserFk1785283200000.name].every((n) =>
      ranNames.includes(n),
    ),
    ranNames.join(','),
  );
  {
    const t = await tablesPresent(mig);
    check(
      'referral tables recreated',
      REFERRAL_TABLES.every((x) => t.includes(x)),
      REFERRAL_TABLES.filter((x) => !t.includes(x)).join(',') || 'all present',
    );
    const cols = await userCols(mig);
    check(
      'users referral columns recreated',
      cols.length === 4,
      cols.join(','),
    );
    const vals = await txEnumValues(mig);
    check(
      'tx enum has new values again',
      ['referral_bonus', 'quest_reward'].every((v) => vals.includes(v)),
      vals.join(','),
    );

    // daily_checkins.user_id should now look like every other user reference in
    // this schema rather than the bare string it was created as.
    const t1 = await columnType(mig, 'daily_checkins', 'user_id');
    check('daily_checkins.user_id is uuid', t1 === 'uuid', t1);
    const fk = await foreignKeyRule(mig, 'daily_checkins', 'user_id');
    check(
      'daily_checkins.user_id cascades from users',
      fk === 'users:CASCADE',
      fk,
    );
    const idx = await indexNames(mig, 'daily_checkins');
    check(
      'unique index IDX_b64ec61f9626d0678e8c62fe16 survived the retype',
      idx.includes('IDX_b64ec61f9626d0678e8c62fe16'),
      idx.join(',') || 'none',
    );
    check(
      'a unique index still covers (user_id, checkin_date)',
      await hasUniqueCheckinPair(mig),
    );

    // The siblings it was supposed to match all along.
    for (const [table, col] of [
      ['daily_draw_awards', 'user_id'],
      ['quest_completions', 'user_id'],
      ['partner_applications', 'user_id'],
      ['referral_earnings', 'beneficiary_id'],
    ] as const) {
      const ct = await columnType(mig, table, col);
      check(`${table}.${col} is uuid (unchanged)`, ct === 'uuid', ct);
    }
  }

  // ---- phase 4: the migrated schema must match the entities exactly ---
  {
    const diff = await mig.driver.createSchemaBuilder().log();
    check(
      'no drift between migrated schema and entities',
      diff.upQueries.length === 0,
      diff.upQueries
        .map((q) => q.query)
        .join(' | ')
        .slice(0, 800) || 'clean',
    );
  }

  // ---- phase 5: running up() a second time must be harmless -----------
  const checkinFk = new DailyCheckinUserFk1785283200000();
  {
    const qr2 = mig.createQueryRunner();
    await qr2.connect();
    try {
      await migration.up(qr2);
      check('referral up() is idempotent (second run)', true);
    } catch (e) {
      check('referral up() is idempotent (second run)', false, msg(e));
    }
    // The referral migration recreates daily_checkins only if it is missing, so
    // the second run leaves the converted column alone — but the checkin
    // migration still has to tolerate finding its own work already done.
    try {
      await checkinFk.up(qr2);
      check('checkin-fk up() is idempotent (second run)', true);
    } catch (e) {
      check('checkin-fk up() is idempotent (second run)', false, msg(e));
    }
    const t2 = await columnType(qr2, 'daily_checkins', 'user_id');
    check('daily_checkins.user_id still uuid after re-run', t2 === 'uuid', t2);
    await qr2.release();
    const diff = await mig.driver.createSchemaBuilder().log();
    check(
      'still no drift after re-running up()',
      diff.upQueries.length === 0,
      diff.upQueries
        .map((q) => q.query)
        .join(' | ')
        .slice(0, 800) || 'clean',
    );
  }

  // ---- phase 6: the checkin foreign key against rows already there -----
  // Everything above proves the shape on an empty table. The interesting case is
  // a table with history in it: the migration has to delete check-ins whose user
  // is gone before Postgres will accept the constraint, and it must not take any
  // others with them.
  {
    const qr4 = mig.createQueryRunner();
    await qr4.connect();

    // Back to the pre-fix shape: varchar, no foreign key, so rows that could
    // never exist afterwards can be planted.
    await checkinFk.down(qr4);
    const before = await columnType(qr4, 'daily_checkins', 'user_id');
    check(
      'down() puts user_id back to varchar',
      before === 'character varying',
      before,
    );
    check(
      'down() removed the foreign key',
      (await foreignKeyRule(qr4, 'daily_checkins', 'user_id')) === '(no fk)',
    );

    const [{ id: liveUser }] = await rows<{ id: string }>(
      qr4,
      `INSERT INTO users (email, role) VALUES ('checkin-keep@test.local', 'investor') RETURNING id`,
    );
    await qr4.query(
      `INSERT INTO daily_checkins (user_id, checkin_date) VALUES ($1, '2026-07-01')`,
      [liveUser],
    );
    // A well-formed uuid that belongs to nobody — what a deleted user leaves.
    await qr4.query(
      `INSERT INTO daily_checkins (user_id, checkin_date)
       VALUES ('00000000-0000-4000-8000-000000000001', '2026-07-02')`,
    );
    // And a value that is not a uuid at all, which only a varchar column could
    // ever have accepted. It must be swept as an orphan, not crash the cast.
    await qr4.query(
      `INSERT INTO daily_checkins (user_id, checkin_date) VALUES ('not-a-uuid', '2026-07-03')`,
    );
    check(
      'planted 3 rows on the pre-fix column',
      (await countOf(qr4, `SELECT count(*) FROM daily_checkins`)) === 3,
    );

    await checkinFk.up(qr4);

    const kept = await rows<{ uid: string }>(
      qr4,
      `SELECT user_id::text AS uid FROM daily_checkins`,
    );
    check(
      'the orphan and the junk row are gone, the real one stayed',
      kept.length === 1 && kept[0].uid === liveUser,
      kept.map((r) => r.uid).join(',') || 'table empty',
    );
    const after = await columnType(qr4, 'daily_checkins', 'user_id');
    check(
      'user_id converted to uuid with rows present',
      after === 'uuid',
      after,
    );
    const fk2 = await foreignKeyRule(qr4, 'daily_checkins', 'user_id');
    check('foreign key added with rows present', fk2 === 'users:CASCADE', fk2);
    const idx2 = await indexNames(qr4, 'daily_checkins');
    check(
      'unique index survived the retype with rows present',
      idx2.includes('IDX_b64ec61f9626d0678e8c62fe16'),
      idx2.join(',') || 'none',
    );

    // The unique pair still has to reject a second check-in for the same day —
    // the property the streak counter depends on.
    let rejected = false;
    try {
      await qr4.query(
        `INSERT INTO daily_checkins (user_id, checkin_date) VALUES ($1, '2026-07-01')`,
        [liveUser],
      );
    } catch {
      rejected = true;
    }
    check('a duplicate (user, day) is still rejected', rejected);

    // And the whole point: deleting the user now takes the check-ins with them
    // instead of leaving rows that keep feeding somebody's streak.
    await qr4.query(`DELETE FROM users WHERE id = $1`, [liveUser]);
    const left = await countOf(qr4, `SELECT count(*) FROM daily_checkins`);
    check(
      'deleting the user cascades to their check-ins',
      left === 0,
      `${left} row(s) left`,
    );

    await qr4.release();
  }

  // ---- phase 7: down() must refuse when real payouts exist ------------
  {
    const qr3 = mig.createQueryRunner();
    await qr3.connect();
    const [{ id: userId }] = await rows<{ id: string }>(
      qr3,
      `INSERT INTO users (email, role) VALUES ('guard@test.local', 'investor') RETURNING id`,
    );
    await qr3.query(
      `INSERT INTO transactions (user_id, type, amount, status)
       VALUES ($1, 'referral_bonus', 100, 'completed')`,
      [userId],
    );
    try {
      await migration.down(qr3);
      check(
        'down() refuses while referral_bonus transactions exist',
        false,
        'it did NOT refuse',
      );
    } catch (e) {
      check(
        'down() refuses while referral_bonus transactions exist',
        /Cannot revert/.test(msg(e)),
        msg(e).split('\n')[0],
      );
    }
    await qr3.release();
  }

  await mig.destroy();
  console.log(
    `\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('\nFATAL:', e);
  process.exit(1);
});
