import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Screens used to fetch on every focus and blank themselves into a spinner while they
 * waited, so returning to a tab you left ten seconds ago cost a full round trip to a
 * server that is asleep half the time. This keeps the last answer for each key and
 * hands it back immediately, refetching quietly behind whatever is already on screen.
 *
 * The cache lives at module scope rather than in a provider, which is the point: it has
 * to outlive the screens that read it. That also makes clearing it on sign-out a
 * correctness matter and not housekeeping — see clearQueryCache, called from logout.
 */

type CacheEntry = { data: unknown; at: number };

const cache = new Map<string, CacheEntry>();

// One request per key at a time, so two screens waking together ask the server once.
const inFlight = new Map<string, Promise<unknown>>();

// Long enough that moving between tabs never waits, short enough that a figure you just
// changed elsewhere is right again by the time you have looked at something else. A
// screen that needs stricter than this should say so rather than lowering it for all.
const DEFAULT_STALE_TIME = 30_000;

/**
 * Drops cached answers whose key is `prefix` or begins `prefix:`, so a screen that
 * changed something on the server can retire what other screens are holding. They
 * refetch the next time they are looked at.
 */
export function invalidateQuery(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key === prefix || key.startsWith(`${prefix}:`)) cache.delete(key);
  }
}

/**
 * Reads a cached answer without subscribing to it or triggering a fetch.
 *
 * For code that is not a screen and has no business asking the server: the guided tour uses
 * it to find a project to open, and would rather skip that step than make a request on
 * someone's behalf.
 */
export function peekQuery<T>(key: string): T | null {
  return (cache.get(key)?.data as T) ?? null;
}

/**
 * Empties the cache. Belongs to sign-out: the keys carry no user in them, so without
 * this the next person to sign in on the device would be shown the last one's balance.
 */
export function clearQueryCache(): void {
  cache.clear();
  inFlight.clear();
}

function dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

type State<T> = {
  key: string;
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: unknown;
};

function fromCache<T>(key: string, enabled: boolean): State<T> {
  const entry = cache.get(key);
  return {
    key,
    data: (entry?.data as T) ?? null,
    // Only the first ever load blocks. Once there is something to show, an update
    // happens under it.
    loading: enabled && !entry,
    refreshing: false,
    error: null,
  };
}

export interface CachedQuery<T> {
  data: T | null;
  /** No data yet and a request is out — the only state worth a full-screen spinner. */
  loading: boolean;
  /** Data is on screen and a newer copy is on its way. */
  refreshing: boolean;
  error: unknown;
  /** Refetches regardless of age. For pull-to-refresh, and after a mutation. */
  refresh: () => Promise<void>;
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { staleTime?: number; enabled?: boolean } = {},
): CachedQuery<T> {
  const { staleTime = DEFAULT_STALE_TIME, enabled = true } = options;

  const [state, setState] = useState<State<T>>(() => fromCache<T>(key, enabled));

  // Held in a ref so a caller who builds the fetcher inline does not restart the
  // request on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Bumped whenever a result stops being the one this screen is waiting for: the key
  // changed, or the screen lost focus. A late answer is still worth caching — someone
  // asked for it — but it must not be rendered over whatever is there now.
  const generation = useRef(0);

  const run = useCallback(
    async (force: boolean) => {
      const entry = cache.get(key);
      if (!force && entry && Date.now() - entry.at < staleTime) {
        setState({ key, data: entry.data as T, loading: false, refreshing: false, error: null });
        return;
      }

      const mine = ++generation.current;
      setState({
        key,
        data: (entry?.data as T) ?? null,
        loading: !entry,
        refreshing: !!entry,
        error: null,
      });

      try {
        const data = await dedupe(key, fetcherRef.current);
        cache.set(key, { data, at: Date.now() });
        if (generation.current === mine) {
          setState({ key, data, loading: false, refreshing: false, error: null });
        }
      } catch (err) {
        // The stale copy stays on screen. A failed background refresh is not a reason
        // to take away figures that were correct a minute ago.
        if (generation.current === mine) {
          setState((s) => ({ ...s, loading: false, refreshing: false, error: err }));
        }
      }
    },
    [key, staleTime],
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void run(false);
      return () => {
        generation.current += 1;
      };
    }, [enabled, run]),
  );

  const refresh = useCallback(() => run(true), [run]);

  // The render right after `key` changes happens before the effect that reacts to it,
  // so trust the key over the state: show the new key's cached answer if there is one,
  // and nothing rather than the old key's data if there is not.
  const current = state.key === key ? state : fromCache<T>(key, enabled);

  return {
    data: current.data,
    loading: current.loading,
    refreshing: current.refreshing,
    error: current.error,
    refresh,
  };
}
