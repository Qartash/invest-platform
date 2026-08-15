import { cronLockKey } from './cron-lock';

/**
 * The lock key is the whole mechanism: two instances only avoid running the same job twice
 * if they compute the same number for it. Anything random, anything per-process, anything
 * that overflows differently under a different Node version, and both take "their own" lock
 * and both run the job — which is the failure this was written to prevent, wearing the
 * disguise of working correctly.
 */
describe('cronLockKey', () => {
  it('gives the same job the same key every time', () => {
    expect(cronLockKey('daily-draw')).toBe(cronLockKey('daily-draw'));
  });

  it('gives different jobs different keys', () => {
    const names = ['daily-draw', 'referral-payouts', 'logs-purge', 'notifications-purge', 'founder-nudges'];
    expect(new Set(names.map(cronLockKey)).size).toBe(names.length);
  });

  // Postgres takes advisory lock keys as int4. A number outside that range is an error from
  // the database, at three in the morning, in a job whose failures nobody is watching.
  it('stays inside a signed 32-bit integer', () => {
    for (const name of ['daily-draw', 'referral-payouts', 'logs-purge', '', 'a'.repeat(500)]) {
      const key = cronLockKey(name);
      expect(Number.isInteger(key)).toBe(true);
      expect(key).toBeGreaterThanOrEqual(-(2 ** 31));
      expect(key).toBeLessThanOrEqual(2 ** 31 - 1);
    }
  });

  // The keys are baked into a running deployment: during a rolling restart an instance on
  // the old build and one on the new build must still agree, or for the length of the
  // deploy the locks stop meaning anything and both run every job. So these are written
  // out rather than recomputed — a change to the hash has to fail here and be a decision,
  // not something noticed afterwards in a doubled payout.
  it('has not drifted', () => {
    expect(cronLockKey('daily-draw')).toBe(1693048183);
    expect(cronLockKey('referral-payouts')).toBe(-1326378314);
    expect(cronLockKey('logs-purge')).toBe(-866386528);
    expect(cronLockKey('notifications-purge')).toBe(997560729);
    expect(cronLockKey('founder-nudges')).toBe(391638283);
  });
});
