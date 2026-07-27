/**
 * Keeps the e2e suite pointed at the throwaway local Postgres, and stops it dead
 * if it ever is not.
 *
 * The suite boots the real AppModule, which builds its own configuration from
 * `.env.local` then `.env`. `.env.local` is the file that holds the URL of the
 * hosted database the deployed API serves from, and AppModule turns TypeORM's
 * `synchronize` on for anything that is not NODE_ENV=production — which a test
 * run never is. Left alone, `npm run test:e2e` would therefore connect to the
 * live database and let TypeORM rewrite its schema to match whatever the
 * entities happen to say today. That is not a hypothetical: the daily_checkins
 * foreign key exists precisely because converting that column safely needs
 * orphaned rows deleted first, and `synchronize` does no such thing.
 *
 * Two separate mechanisms, because one of them is an optimisation and the other
 * is the actual guarantee:
 *
 * - `loadTestEnv` puts the local connection into process.env before Nest starts.
 *   Both dotenv and @nestjs/config only fill in keys that are not already set,
 *   so what is in process.env by then wins over both env files.
 * - `assertLocalTarget` does not trust any of that. It resolves the connection
 *   the same way AppModule does and refuses to let the run continue unless the
 *   answer is a local, disposable database. If the precedence above ever changes
 *   under us, the suite fails loudly instead of quietly reaching production.
 */
import { config as readEnvFile } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

// ::1 included because Node resolves "localhost" to it first on some machines.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

// The database the developer's own app uses. `synchronize` would happily alter
// it, so the e2e suite is not allowed to borrow it even though it is local.
const DEV_DATABASE = 'invest_platform';

export type Target = {
  host: string;
  port: number;
  database: string;
  // Which of the two branches in AppModule's factory produced this, so a refusal
  // can tell the reader which variable to go and fix.
  source: string;
};

export const loadTestEnv = (): void => {
  // `quiet` suppresses the banner dotenv prints on load, which otherwise lands
  // in the middle of the test output twice per run.
  readEnvFile({ path: join(__dirname, '..', '.env.test'), quiet: true });
};

// Mirrors the useFactory in src/app.module.ts, including its defaults: a URL
// wins outright when present, otherwise the connection is assembled from the
// discrete vars. Kept in step with that factory by hand — there is no shared
// helper to import, because the app must not depend on test code.
export const resolveTarget = (): Target => {
  const url = process.env.DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, ''),
      source: 'DATABASE_URL',
    };
  }
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? DEV_DATABASE,
    source: 'DB_HOST/DB_PORT/DB_NAME',
  };
};

export const assertLocalTarget = (): Target => {
  const target = resolveTarget();

  if (!LOCAL_HOSTS.has(target.host)) {
    throw new Error(
      `Refusing to run the e2e suite against "${target.host}".\n` +
        `It resolved from ${target.source}, and the suite boots the app with ` +
        `schema synchronization enabled — pointing it at a hosted database ` +
        `would let TypeORM alter that database's schema.\n` +
        `Unset DATABASE_URL (backend/.env.test does this) and start the local ` +
        `server with: docker compose up -d postgres`,
    );
  }

  if (target.database === DEV_DATABASE) {
    throw new Error(
      `Refusing to run the e2e suite against the "${DEV_DATABASE}" database.\n` +
        `The suite synchronizes the schema and writes rows, which would rewrite ` +
        `your local development data. Point DB_NAME at a disposable database ` +
        `instead; backend/.env.test uses "invest_platform_e2e".`,
    );
  }

  return target;
};

// The suite creates its own tables through `synchronize`, but nothing creates
// the database itself, and connecting to one that does not exist just fails.
export const ensureDatabase = async (target: Target): Promise<void> => {
  const admin = new DataSource({
    type: 'postgres',
    host: target.host,
    port: target.port,
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres',
  });

  try {
    await admin.initialize();
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Cannot reach the local Postgres at ${target.host}:${target.port} (${reason}).\n` +
        `Start it from the repository root with: docker compose up -d postgres`,
    );
  }

  const existing: unknown[] = await admin.query(
    `select 1 from pg_database where datname = $1`,
    [target.database],
  );
  if (existing.length === 0) {
    // The name is not user input — it has already been through assertLocalTarget
    // — but it still cannot be a bound parameter in CREATE DATABASE.
    await admin.query(`CREATE DATABASE "${target.database}"`);
  }

  await admin.destroy();
};
