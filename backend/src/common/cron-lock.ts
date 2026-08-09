import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Runs a scheduled job only if no other process is already running it.
 *
 * Every `@Cron` in this codebase lives inside the web process, so today — one instance —
 * a job can only ever be running once and none of this is needed. The moment there are
 * two instances, every one of them fires the same cron at the same second: the draw pays
 * two people for one seat, the referral queue pays a matured earning twice, and the purge
 * jobs fight over the same rows. That is not a failure anybody would notice from the
 * outside until the money had already moved.
 *
 * Postgres advisory locks are the cheapest fix: no table, no rows, nothing to clean up.
 * The lock is held by the connection that took it and released when the job finishes, so
 * a process that dies mid-job drops its lock with its connection rather than blocking the
 * next run forever — which is exactly what a lock stored in a table would do.
 *
 * A caller that does not get the lock returns `null` and logs nothing louder than a debug
 * line: another instance is doing the work, which is the intended outcome, not an error.
 */

// The first half of the (int4, int4) lock key. Fixed for this application, so our locks
// can never collide with an advisory lock taken by anything else against the same database.
const CRON_LOCK_CLASS_ID = 1917;

/**
 * A stable 32-bit signed integer for a job name. FNV-1a, because it needs to be the same
 * number in every process and across restarts — a random or per-boot id would let two
 * instances each take "their own" lock and both run the job.
 */
export function cronLockKey(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    // The FNV prime, as shifts, because a plain multiply overflows past 2^53 in JS.
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // `| 0` reinterprets the 32 bits as signed, which is the range Postgres int4 accepts.
  return hash | 0;
}

const logger = new Logger('CronLock');

export async function withCronLock<T>(
  dataSource: DataSource,
  name: string,
  run: () => Promise<T>,
): Promise<T | null> {
  const key = cronLockKey(name);
  // A dedicated connection for the whole job: an advisory lock belongs to the session that
  // took it, so releasing it has to happen on the same connection, and a pooled query could
  // land anywhere. This is also why the runner is released in a `finally` — a leaked
  // connection here would be one fewer for the requests the job is running alongside.
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    const rows = (await runner.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [
      CRON_LOCK_CLASS_ID,
      key,
    ])) as Array<{ locked: boolean }>;
    if (!rows[0]?.locked) {
      logger.debug(`Skipping ${name}: another instance holds the lock`);
      return null;
    }
    try {
      return await run();
    } finally {
      await runner.query('SELECT pg_advisory_unlock($1, $2)', [CRON_LOCK_CLASS_ID, key]);
    }
  } finally {
    await runner.release();
  }
}
