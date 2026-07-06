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

export function computeTicketPricing(project: {
  ticketPrice: string;
  totalTickets: number;
  ticketsSold: number;
  priceTierCount: number;
  priceTierIncrementPercent: string;
}): TicketPricing {
  const basePrice = parseFloat(project.ticketPrice);
  const incrementPercent = parseFloat(project.priceTierIncrementPercent);
  const totalTiers = Math.max(1, project.priceTierCount);
  const tierSize = Math.max(1, Math.ceil(project.totalTickets / totalTiers));

  const tiers: TicketPriceTier[] = Array.from({ length: totalTiers }, (_, i) => ({
    tier: i,
    ticketsFrom: i * tierSize,
    ticketsTo: Math.min((i + 1) * tierSize, project.totalTickets),
    price: Math.round(basePrice * Math.pow(1 + incrementPercent / 100, i) * 100) / 100,
  }));

  const currentTier = Math.min(Math.floor(project.ticketsSold / tierSize), totalTiers - 1);

  return {
    currentTicketPrice: tiers[currentTier].price,
    currentTier,
    totalTiers,
    tierSize,
    tiers,
  };
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
