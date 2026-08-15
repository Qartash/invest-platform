// The per-level reward for the referral ladder, in AMD. Mirrors design/referral.html:
// the closest levels earn most, the reward steps down twice, then never stops.
// `from`/`to` are inclusive relative levels (1 = someone you invited directly);
// the last band runs to infinity.
export interface LadderBand {
  from: number;
  to: number;
  amount: number;
}

export const REFERRAL_LADDER: LadderBand[] = [
  { from: 1, to: 5, amount: 100 },
  { from: 6, to: 15, amount: 50 },
  { from: 16, to: Infinity, amount: 10 },
];

// The one-time cut of an invitee's first deposit that goes to their direct
// referrer, on top of that referrer's level-1 ladder bonus.
export const FIRST_DEPOSIT_PERCENT = 0.01;

/**
 * Partner rates. A partner is someone with an audience who signed a contract, so
 * they are paid more per person — and in real money — but only for people they
 * brought in themselves: no ladder, no depth. That trade is what keeps the
 * partner programme advertising-with-payment-for-results rather than a network,
 * which is both the honest description and the one that fits a contract.
 */
export const PARTNER_FLAT = 500;
export const PARTNER_PERCENT = 0.02;
export const PARTNER_PERCENT_CAP = 10_000;

// How long an earning waits before it can be paid, so a refunded deposit or a
// fraud finding can void it before any money leaves the admin account.
export const REFERRAL_HOLD_DAYS = 14;

// The flat ladder bonus for a given relative level. Levels below 1 earn nothing.
export function ladderAmount(level: number): number {
  if (level < 1) return 0;
  const band = REFERRAL_LADDER.find((b) => level >= b.from && level <= b.to);
  return band?.amount ?? 0;
}

/**
 * What one ancestor earns when someone below them qualifies, and where it is
 * paid. Null means they earn nothing from this person at all — which is how a
 * partner sitting three levels up is told apart from an ordinary user there.
 *
 * Kept pure and separate from the ledger so the two rate cards can be read, and
 * tested, side by side.
 */
export function priceForAncestor(
  level: number,
  isPartner: boolean,
): { amount: number; toCard: boolean } | null {
  if (isPartner) {
    // Partners are paid for the people they brought in themselves, and nothing
    // for depth — the trade that keeps the programme advertising, not a network.
    if (level !== 1) return null;
    return { amount: PARTNER_FLAT, toCard: true };
  }
  const amount = ladderAmount(level);
  return amount > 0 ? { amount, toCard: false } : null;
}

/** The one-time cut of a first deposit for the direct referrer. */
export function firstDepositCut(deposit: number, isPartner: boolean): { amount: number; toCard: boolean } {
  const amount = isPartner
    ? Math.min(Math.round(deposit * PARTNER_PERCENT), PARTNER_PERCENT_CAP)
    : Math.round(deposit * FIRST_DEPOSIT_PERCENT);
  return { amount, toCard: isPartner };
}
