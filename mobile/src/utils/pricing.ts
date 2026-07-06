export interface PricingPreviewTier {
  tier: number;
  ticketsFrom: number;
  ticketsTo: number;
  price: number;
}

// Matches backend/src/projects/entities/project.entity.ts default for
// price_tier_increment_percent, used whenever a caller doesn't pass one in.
export const DEFAULT_TIER_INCREMENT_PERCENT = 20;

export function computeTicketPricingPreview(opts: {
  ticketPrice: number;
  totalTickets: number;
  priceTierCount: number;
  incrementPercent?: number;
}): PricingPreviewTier[] {
  if (opts.ticketPrice <= 0 || opts.totalTickets <= 0) return [];

  const incrementPercent = opts.incrementPercent ?? DEFAULT_TIER_INCREMENT_PERCENT;
  const totalTiers = Math.max(1, Math.min(10, Math.round(opts.priceTierCount) || 1));
  const tierSize = Math.max(1, Math.ceil(opts.totalTickets / totalTiers));

  return Array.from({ length: totalTiers }, (_, i) => ({
    tier: i,
    ticketsFrom: i * tierSize,
    ticketsTo: Math.min((i + 1) * tierSize, opts.totalTickets),
    price: Math.round(opts.ticketPrice * Math.pow(1 + incrementPercent / 100, i) * 100) / 100,
  }));
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

export function estimateFullRaiseAmount(tiers: PricingPreviewTier[]): number {
  return tiers.reduce((sum, tier) => sum + tier.price * (tier.ticketsTo - tier.ticketsFrom), 0);
}

// Reverse of computeTicketPricingPreview: given the funding goal, ticket count and
// number of price rounds, solve for the base (first-round) ticket price so that
// selling out every round adds up to exactly the funding goal. This keeps the three
// numbers (goal / price / ticket count) always consistent instead of letting a
// founder enter them independently and drift apart.
export function deriveBaseTicketPrice(opts: {
  targetAmount: number;
  totalTickets: number;
  priceTierCount: number;
  incrementPercent?: number;
}): number {
  if (opts.targetAmount <= 0 || opts.totalTickets <= 0) return 0;

  const incrementPercent = opts.incrementPercent ?? DEFAULT_TIER_INCREMENT_PERCENT;
  const totalTiers = Math.max(1, Math.min(10, Math.round(opts.priceTierCount) || 1));
  const tierSize = Math.max(1, Math.ceil(opts.totalTickets / totalTiers));

  let weightedTickets = 0;
  for (let i = 0; i < totalTiers; i++) {
    const from = i * tierSize;
    const to = Math.min((i + 1) * tierSize, opts.totalTickets);
    const ticketsInTier = Math.max(0, to - from);
    weightedTickets += ticketsInTier * Math.pow(1 + incrementPercent / 100, i);
  }

  if (weightedTickets <= 0) return 0;
  return Math.round((opts.targetAmount / weightedTickets) * 100) / 100;
}
