/**
 * A small server-side cache for answers that are the same for everyone.
 *
 * The project list is the case it was built for: every visitor gets identical bytes, yet
 * each open cost a fresh set of queries against a database that is often asleep. Holding
 * the answer for half a minute means most opens never reach the database at all.
 *
 * Two rules keep it honest. Anything cached here must not depend on who is asking — a key
 * with no user in it holding a per-user answer would serve one person's figures to the
 * next. And whatever writes the underlying data must call `invalidateCached`, which is why
 * this is a module-level function rather than an injectable: the writers live in modules
 * that cannot import the readers' module without a dependency cycle.
 */

type Entry = { value: unknown; expiresAt: number };

const entries = new Map<string, Entry>();

// One producer per key at a time. Without this, the first request after an entry expires
// lets every other request in flight run the same queries — precisely when the database is
// slowest and the requests are piling up.
const inFlight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
  const entry = entries.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;

  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = produce()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

/** Drops every entry whose key is `prefix` or starts with `prefix:`. */
export function invalidateCached(prefix: string): void {
  for (const key of [...entries.keys()]) {
    if (key === prefix || key.startsWith(`${prefix}:`)) entries.delete(key);
  }
}

/**
 * Drops everything. For the admin wipe, which empties the tables all of these were
 * computed from — naming the prefixes one by one would mean a stale answer survives
 * every time a new cached key is added and this list is not.
 */
export function invalidateAllCached(): void {
  entries.clear();
}
