// The daily draw's money, kept pure so the rate card can be read — and tested —
// apart from the ledger that pays it out.

// What one winner gets. The pot is always a whole multiple of this, so a seat is
// never a fraction of a share.
export const DRAW_SHARE = 100;

/**
 * What the platform puts up for each person who arrived that day with nobody's
 * code. A referred arrival costs the ladder real money; a code-less one costs
 * nothing, and this is that same budget spent on the people who were here
 * instead.
 *
 * Per arrival rather than a flat daily pot: a flat pot is split among everyone
 * active, so the odds shrink as the platform grows and the draw quietly stops
 * meaning anything to anyone. Tied to arrivals, the pot grows with the thing it
 * stands in for and one person's chance stays roughly where it started.
 */
export const POOL_PER_ARRIVAL = 2000;

/**
 * Ceiling on a single day's spend. Registration is free and unverified, so
 * arrivals are something an outsider can manufacture — without this, minting
 * draw money would cost them nothing but the effort of signing up. It is a
 * safety valve, not the normal case: an ordinary day should never reach it.
 */
export const MAX_DAILY_POOL = 100_000;

/** The whole pot for a day. Zero days are days the draw does not run at all. */
export function poolFor(organicArrivals: number): number {
  if (organicArrivals <= 0) return 0;
  return Math.min(organicArrivals * POOL_PER_ARRIVAL, MAX_DAILY_POOL);
}

/**
 * How many people the pot can pay. This is the money's limit alone — the crowd's
 * limit is applied by the caller, which cannot hand out more seats than there
 * are participants to fill them.
 */
export function seatsFor(organicArrivals: number): number {
  return Math.floor(poolFor(organicArrivals) / DRAW_SHARE);
}

/**
 * One participant's odds, as a fraction of 1. Capped at certainty: on a small
 * day there are more seats than people, and everybody wins.
 */
export function chanceOf(seats: number, participants: number): number {
  if (participants <= 0 || seats <= 0) return 0;
  return Math.min(seats / participants, 1);
}
