import {
  FIRST_DEPOSIT_PERCENT,
  PARTNER_FLAT,
  PARTNER_PERCENT_CAP,
  REFERRAL_LADDER,
  firstDepositCut,
  ladderAmount,
  priceForAncestor,
} from './ladder';

describe('ladderAmount', () => {
  // The three bands from design/referral.html: 100 for the near circle, 50 for
  // the far circle, 10 forever after.
  it.each([
    [1, 100],
    [3, 100],
    [5, 100],
    [6, 50],
    [10, 50],
    [15, 50],
    [16, 10],
    [100, 10],
    [10_000, 10],
  ])('pays %i AMD at level %i', (level, expected) => {
    expect(ladderAmount(level)).toBe(expected);
  });

  // Level 0 and below are not real ancestors and must earn nothing, so a bad
  // caller can't mint a bonus from a malformed path.
  it.each([[0], [-1], [-100]])('pays nothing at non-positive level %i', (level) => {
    expect(ladderAmount(level)).toBe(0);
  });

  // The bands must tile the positive integers with no gap and no overlap: every
  // level lands in exactly one band, so no ancestor is skipped or double-counted.
  it('covers every positive level with exactly one band', () => {
    for (let level = 1; level <= 1000; level += 1) {
      const matches = REFERRAL_LADDER.filter((b) => level >= b.from && level <= b.to);
      expect(matches).toHaveLength(1);
    }
  });

  it('keeps the first-deposit cut at 1%', () => {
    expect(FIRST_DEPOSIT_PERCENT).toBeCloseTo(0.01);
    expect(Math.round(35_000 * FIRST_DEPOSIT_PERCENT)).toBe(350);
  });
});

describe('priceForAncestor', () => {
  // An ordinary user is paid by the ladder, into invest credit, at every depth.
  it.each([
    [1, 100],
    [7, 50],
    [20, 10],
  ])('pays an ordinary ancestor the ladder rate at level %i', (level, amount) => {
    expect(priceForAncestor(level, false)).toEqual({ amount, toCard: false });
  });

  it('pays a partner a flat rate in cash for their own invitee', () => {
    expect(priceForAncestor(1, true)).toEqual({ amount: PARTNER_FLAT, toCard: true });
  });

  // The rule that keeps the partner programme from being a network: a partner
  // earns nothing from people their invitees go on to bring in.
  it.each([[2], [3], [10]])('pays a partner nothing at depth %i', (level) => {
    expect(priceForAncestor(level, true)).toBeNull();
  });

  // A partner deeper in someone else's chain must not silently collect the
  // ordinary ladder either — that would reintroduce depth income by the back door.
  it('does not fall back to the ladder for a deep partner', () => {
    expect(priceForAncestor(4, true)).toBeNull();
    expect(priceForAncestor(4, false)).toEqual({ amount: 100, toCard: false });
  });
});

describe('firstDepositCut', () => {
  it('gives an ordinary referrer 1%, into invest credit', () => {
    expect(firstDepositCut(35_000, false)).toEqual({ amount: 350, toCard: false });
  });

  it('gives a partner 2%, in cash', () => {
    expect(firstDepositCut(35_000, true)).toEqual({ amount: 700, toCard: true });
  });

  // The cap is what stops one very large deposit from writing an unbounded cheque.
  it('caps the partner cut', () => {
    expect(firstDepositCut(100_000_000, true)).toEqual({ amount: PARTNER_PERCENT_CAP, toCard: true });
  });

  it('rounds to whole drams rather than fractions', () => {
    expect(Number.isInteger(firstDepositCut(12_345, false).amount)).toBe(true);
    expect(Number.isInteger(firstDepositCut(12_345, true).amount)).toBe(true);
  });
});
