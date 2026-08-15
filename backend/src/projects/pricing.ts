// Mirrors the Max(10) on priceTierCount in CreateProjectDto.
export const MAX_PRICE_TIERS = 10;

export interface TicketPriceTier {
  tier: number;
  ticketsFrom: number;
  ticketsTo: number;
  price: number;
}

export interface TicketPricing {
  currentTicketPrice: number;
  currentTier: number;
  totalTiers: number;
  tierSize: number;
  tiers: TicketPriceTier[];
}

export interface TierRange {
  tier: number;
  ticketsFrom: number;
  ticketsTo: number;
}

/**
 * The ticket ranges the rounds are laid out on, shared by every price calculation.
 * Deriving the base price and pricing a live project are inverses of each other and
 * only cancel out on an identical layout, so both read their ranges from here.
 *
 * Rounds that start past the last ticket are dropped rather than emitted empty: with
 * fewer tickets than rounds (5 tickets over 10 rounds, or 7 over 5, both of which pass
 * DTO validation) a trailing round's ticketsFrom runs past totalTickets while ticketsTo
 * is clamped to it. That inverted range renders as "3–1" in the rounds table, counts as
 * a negative ticket count in any sum over the tiers, and drags currentTier onto a round
 * that sells nothing. So totalTiers is the number of rounds that actually hold tickets,
 * which may be fewer than the founder asked for.
 */
export function resolveTierLayout(totalTickets: number, priceTierCount: number) {
  const tickets = Math.max(0, Math.floor(totalTickets));
  const requested = Math.max(1, Math.min(MAX_PRICE_TIERS, Math.round(priceTierCount) || 1));
  const tierSize = Math.max(1, Math.ceil(tickets / requested));

  const ranges: TierRange[] = [];
  for (let i = 0; i < requested; i++) {
    const ticketsFrom = i * tierSize;
    if (ticketsFrom >= tickets) break;
    ranges.push({ tier: ranges.length, ticketsFrom, ticketsTo: Math.min(ticketsFrom + tierSize, tickets) });
  }
  if (ranges.length === 0) ranges.push({ tier: 0, ticketsFrom: 0, ticketsTo: tickets });

  return { totalTiers: ranges.length, tierSize, ranges };
}

// How far the last round's price may be nudged to absorb rounding, as a share of that
// round's own price. Rounding residuals land near 0.05%; a base price that was never
// derived from the goal is off by tens of percent. 1% separates the two by ~20x.
const ABSORB_TOLERANCE = 0.01;

/**
 * Prices each round by compounding the increment off the base price, then lets the last
 * round absorb whatever the cent-rounding of the earlier rounds left on the table.
 *
 * Without the absorption the per-round rounding accumulates: 120,000 tickets over 10
 * rounds landed a full sell-out 720 short of the goal, which showed a project that had
 * sold every ticket at 99.99% funded. The absorption is exact whenever the leftover
 * divides evenly into the last round's ticket count — the case for a round goal and
 * equal-sized rounds. Where cents simply can't express it (one round of 120,000 tickets
 * against a 5,000,000 goal wants 41.6667 per ticket) it lands as close as a cent-priced
 * round can, instead of drifting unbounded with the ticket count.
 *
 * Only a rounding-sized residual is absorbed. A larger gap means the base price wasn't
 * derived from the goal at all — a row stored before the price moved server-side — and
 * forcing the ladder onto the goal there would price the last round below the first
 * (a 5,000,000 goal with a hardcoded 50,000 base drops round 4 from 86,400 to 18,000).
 * Those rows are repair-ticket-prices.ts's job, not something to paper over here.
 */
export function computeTicketPricing(project: {
  ticketPrice: string;
  targetAmount: string;
  totalTickets: number;
  ticketsSold: number;
  priceTierCount: number;
  priceTierIncrementPercent: string;
}): TicketPricing {
  const basePrice = parseFloat(project.ticketPrice);
  const incrementPercent = parseFloat(project.priceTierIncrementPercent);
  const targetAmount = parseFloat(project.targetAmount);
  const { totalTiers, tierSize, ranges } = resolveTierLayout(project.totalTickets, project.priceTierCount);

  const tiers: TicketPriceTier[] = ranges.map((range) => ({
    ...range,
    price: Math.round(basePrice * Math.pow(1 + incrementPercent / 100, range.tier) * 100) / 100,
  }));

  const last = tiers[tiers.length - 1];
  const lastCount = last.ticketsTo - last.ticketsFrom;
  if (targetAmount > 0 && lastCount > 0) {
    const others = tiers
      .slice(0, -1)
      .reduce((sum, tier) => sum + tier.price * (tier.ticketsTo - tier.ticketsFrom), 0);
    const absorbed = Math.round(((targetAmount - others) / lastCount) * 100) / 100;
    const tolerance = Math.max(0.01, last.price * ABSORB_TOLERANCE);
    if (absorbed > 0 && Math.abs(absorbed - last.price) <= tolerance) {
      last.price = absorbed;
    }
  }

  const currentTier = Math.max(0, Math.min(Math.floor(project.ticketsSold / tierSize), totalTiers - 1));

  return {
    currentTicketPrice: tiers[currentTier].price,
    currentTier,
    totalTiers,
    tierSize,
    tiers,
  };
}

// Inverse of computeTicketPricing: given the funding goal, ticket count and rounds,
// solve for the round-1 price so that selling every ticket raises exactly the goal.
//
// This is the invariant the whole funding UI rests on, and it is not `targetAmount /
// totalTickets` — later rounds cost more, so a naive base price overshoots the goal by
// the ratio of the round multipliers to the round count (34% at the default 4 rounds
// and +20%). It lives here, server-side, because every writer has to hold to it: a
// client that computed its own price could quietly put the project back out of balance.
export function deriveBaseTicketPrice(opts: {
  targetAmount: number;
  totalTickets: number;
  priceTierCount: number;
  incrementPercent: number;
}): number {
  if (opts.targetAmount <= 0 || opts.totalTickets <= 0) return 0;

  const { ranges } = resolveTierLayout(opts.totalTickets, opts.priceTierCount);

  // Tickets restated in round-1 prices: a round-2 ticket at +20% counts as 1.2 tickets.
  const weightedTickets = ranges.reduce(
    (sum, range) =>
      sum + (range.ticketsTo - range.ticketsFrom) * Math.pow(1 + opts.incrementPercent / 100, range.tier),
    0,
  );

  if (weightedTickets <= 0) return 0;
  return Math.round((opts.targetAmount / weightedTickets) * 100) / 100;
}

// A single purchase can span multiple price tiers (e.g. buying 5000 tickets when
// only 500 are left in the current tier), so the cost has to be accumulated tier by
// tier at the price in effect for each ticket rather than charged at one flat price.
export function computeTicketPurchaseCost(tiers: TicketPriceTier[], ticketsSold: number, quantity: number): number {
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
