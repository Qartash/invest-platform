import { chanceOf, DRAW_SHARE, MAX_DAILY_POOL, POOL_PER_ARRIVAL, poolFor, seatsFor } from './draw-pool';

describe('poolFor', () => {
  it('is nothing on a day nobody arrived on their own', () => {
    expect(poolFor(0)).toBe(0);
    expect(poolFor(-1)).toBe(0);
  });

  it('puts up one share of the budget per arrival', () => {
    expect(poolFor(1)).toBe(POOL_PER_ARRIVAL);
    expect(poolFor(7)).toBe(7 * POOL_PER_ARRIVAL);
  });

  // The whole point of the change: the pot has to follow the platform, or the odds
  // fall away as it grows.
  it('grows with arrivals rather than staying flat', () => {
    expect(poolFor(10)).toBeGreaterThan(poolFor(1));
  });

  it('stops at the daily ceiling', () => {
    expect(poolFor(1_000_000)).toBe(MAX_DAILY_POOL);
  });
});

describe('seatsFor', () => {
  it('is what the pot can pay at one share each', () => {
    expect(seatsFor(1)).toBe(POOL_PER_ARRIVAL / DRAW_SHARE);
  });

  it('never sells a fractional seat', () => {
    expect(Number.isInteger(seatsFor(3))).toBe(true);
  });

  it('is nothing when there is no pot', () => {
    expect(seatsFor(0)).toBe(0);
  });
});

describe('chanceOf', () => {
  it('is the share of participants the seats cover', () => {
    expect(chanceOf(20, 40)).toBeCloseTo(0.5);
  });

  it('is certainty when there are more seats than people', () => {
    expect(chanceOf(20, 5)).toBe(1);
  });

  it('is nothing without participants or seats', () => {
    expect(chanceOf(20, 0)).toBe(0);
    expect(chanceOf(0, 20)).toBe(0);
  });

  // A day ten times the size raises the pot ten times too, so one person's odds
  // hold instead of thinning out — which is the property the flat pot lacked.
  it('holds steady as arrivals and participants grow together', () => {
    const small = chanceOf(seatsFor(1), 100);
    const large = chanceOf(seatsFor(10), 1000);
    expect(large).toBeCloseTo(small);
  });
});
