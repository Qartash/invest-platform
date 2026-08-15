export interface PricingPreviewTier {
  tier: number;
  ticketsFrom: number;
  ticketsTo: number;
  price: number;
}

// Matches backend/src/projects/entities/project.entity.ts default for
// price_tier_increment_percent, used whenever a caller doesn't pass one in.
export const DEFAULT_TIER_INCREMENT_PERCENT = 20;

export const MAX_PRICE_TIERS = 10;

/**
 * The ticket ranges the rounds are laid out on. Mirrors resolveTierLayout in
 * backend/src/projects/pricing.ts — keep the two in step.
 *
 * Rounds starting past the last ticket are dropped rather than emitted empty: with
 * fewer tickets than rounds the trailing round's ticketsFrom would run past
 * totalTickets while ticketsTo is clamped to it, which renders as "3–1" in the rounds
 * table and counts as a negative ticket count in any sum over the tiers. So the number
 * of rounds returned may be fewer than the founder asked for.
 */
function resolveTierLayout(totalTickets: number, priceTierCount: number) {
  const tickets = Math.max(0, Math.floor(totalTickets));
  const requested = Math.max(1, Math.min(MAX_PRICE_TIERS, Math.round(priceTierCount) || 1));
  const tierSize = Math.max(1, Math.ceil(tickets / requested));

  const ranges: { tier: number; ticketsFrom: number; ticketsTo: number }[] = [];
  for (let i = 0; i < requested; i++) {
    const ticketsFrom = i * tierSize;
    if (ticketsFrom >= tickets) break;
    ranges.push({ tier: ranges.length, ticketsFrom, ticketsTo: Math.min(ticketsFrom + tierSize, tickets) });
  }
  if (ranges.length === 0) ranges.push({ tier: 0, ticketsFrom: 0, ticketsTo: tickets });

  return { totalTiers: ranges.length, tierSize, ranges };
}

// See ABSORB_TOLERANCE in backend/src/projects/pricing.ts.
const ABSORB_TOLERANCE = 0.01;

/**
 * Mirrors computeTicketPricing in backend/src/projects/pricing.ts, including the way
 * the last round absorbs the cent-rounding left over by the earlier rounds so that
 * selling every ticket adds up to the funding goal. Pass targetAmount to get the same
 * ladder the project will actually launch with; without it the last round keeps its
 * uncorrected price and the preview can sit a few hundred off the goal.
 */
export function computeTicketPricingPreview(opts: {
  ticketPrice: number;
  totalTickets: number;
  priceTierCount: number;
  incrementPercent?: number;
  targetAmount?: number;
}): PricingPreviewTier[] {
  if (opts.ticketPrice <= 0 || opts.totalTickets <= 0) return [];

  const incrementPercent = opts.incrementPercent ?? DEFAULT_TIER_INCREMENT_PERCENT;
  const { ranges } = resolveTierLayout(opts.totalTickets, opts.priceTierCount);

  const tiers = ranges.map((range) => ({
    ...range,
    price: Math.round(opts.ticketPrice * Math.pow(1 + incrementPercent / 100, range.tier) * 100) / 100,
  }));

  const last = tiers[tiers.length - 1];
  const lastCount = last.ticketsTo - last.ticketsFrom;
  if (opts.targetAmount !== undefined && opts.targetAmount > 0 && lastCount > 0) {
    const others = tiers.slice(0, -1).reduce((sum, tier) => sum + tier.price * (tier.ticketsTo - tier.ticketsFrom), 0);
    const absorbed = Math.round(((opts.targetAmount - others) / lastCount) * 100) / 100;
    const tolerance = Math.max(0.01, last.price * ABSORB_TOLERANCE);
    if (absorbed > 0 && Math.abs(absorbed - last.price) <= tolerance) {
      last.price = absorbed;
    }
  }

  return tiers;
}

// A single purchase can span multiple price tiers (e.g. buying 5000 tickets when
// only 500 are left in the current tier), so the cost has to be accumulated tier by
// tier at the price in effect for each ticket rather than charged at one flat price.
export function computeTicketPurchaseCost(tiers: PricingPreviewTier[], ticketsSold: number, quantity: number): number {
  let sold = ticketsSold;
  let remaining = quantity;
  let total = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    if (sold >= tier.ticketsTo) continue;

    const ticketsFromTier = Math.min(tier.ticketsTo - sold, remaining);
    total += ticketsFromTier * tier.price;
    sold += ticketsFromTier;
    remaining -= ticketsFromTier;
  }

  return Math.round(total * 100) / 100;
}

// How many tickets a given budget buys. Not `budget / currentPrice`: the buyer crosses
// into pricier rounds mid-purchase, so each round is filled at its own price until the
// money runs out. Counted in cents to keep the floor exact — a rounding overshoot here
// would hand the user a quantity the backend then rejects as insufficient funds.
export function computeMaxAffordableTickets(
  tiers: PricingPreviewTier[],
  ticketsSold: number,
  budget: number,
  ticketsLeft: number,
): number {
  let sold = ticketsSold;
  let budgetCents = Math.floor(budget * 100);
  let bought = 0;

  for (const tier of tiers) {
    if (bought >= ticketsLeft || budgetCents <= 0) break;
    if (sold >= tier.ticketsTo) continue;

    const priceCents = Math.round(tier.price * 100);
    if (priceCents <= 0) continue;

    const availableInTier = Math.min(tier.ticketsTo - sold, ticketsLeft - bought);
    const affordable = Math.min(availableInTier, Math.floor(budgetCents / priceCents));
    if (affordable <= 0) break;

    bought += affordable;
    sold += affordable;
    budgetCents -= affordable * priceCents;
  }

  return bought;
}

// Every ticket carries the same slice of the company no matter which round it was
// bought in — the rounds discount the price, not the share. Mirrors the payout split
// in backend/src/project-finance/project-finance.service.ts (payReport).
export function equityPerTicket(equityOfferedPercent: number, totalTickets: number): number {
  if (totalTickets <= 0) return 0;
  return equityOfferedPercent / totalTickets;
}

// The share of the company a holding of `quantity` tickets represents.
export function equityForTickets(equityOfferedPercent: number, totalTickets: number, quantity: number): number {
  return equityPerTicket(equityOfferedPercent, totalTickets) * quantity;
}

// What the founder is implicitly valuing the company at: raising the full targetAmount
// hands over exactly equityOfferedPercent of it. Anchored on targetAmount and not on the
// current ticket price, which climbs round by round and would make the valuation drift.
export function impliedValuation(targetAmount: number, equityOfferedPercent: number): number {
  if (targetAmount <= 0 || equityOfferedPercent <= 0) return 0;
  return (targetAmount / equityOfferedPercent) * 100;
}

export function estimateFullRaiseAmount(tiers: PricingPreviewTier[]): number {
  return tiers.reduce((sum, tier) => sum + tier.price * (tier.ticketsTo - tier.ticketsFrom), 0);
}

// Reverse of computeTicketPricingPreview: given the funding goal, ticket count and
// number of price rounds, solve for the base (first-round) ticket price so that
// selling out every round adds up to exactly the funding goal. This keeps the three
// numbers (goal / price / ticket count) always consistent instead of letting a
// founder enter them independently and drift apart.
//
// Preview only — the server derives the price it stores with the same formula and
// ignores whatever the client sends. Keep this in step with deriveBaseTicketPrice in
// backend/src/projects/pricing.ts, or the wizard will quote a price the project
// won't actually launch with.
export function deriveBaseTicketPrice(opts: {
  targetAmount: number;
  totalTickets: number;
  priceTierCount: number;
  incrementPercent?: number;
}): number {
  if (opts.targetAmount <= 0 || opts.totalTickets <= 0) return 0;

  const incrementPercent = opts.incrementPercent ?? DEFAULT_TIER_INCREMENT_PERCENT;
  const { ranges } = resolveTierLayout(opts.totalTickets, opts.priceTierCount);

  const weightedTickets = ranges.reduce(
    (sum, range) => sum + (range.ticketsTo - range.ticketsFrom) * Math.pow(1 + incrementPercent / 100, range.tier),
    0,
  );

  if (weightedTickets <= 0) return 0;
  return Math.round((opts.targetAmount / weightedTickets) * 100) / 100;
}
