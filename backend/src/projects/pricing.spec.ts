import { computeTicketPricing, computeTicketPurchaseCost, deriveBaseTicketPrice, resolveTierLayout } from './pricing';

const sellOutTotal = (
  base: number,
  totalTickets: number,
  priceTierCount: number,
  incrementPercent: number,
  targetAmount = 0,
) =>
  computeTicketPricing({
    ticketPrice: base.toFixed(2),
    targetAmount: targetAmount.toFixed(2),
    totalTickets,
    ticketsSold: 0,
    priceTierCount,
    priceTierIncrementPercent: incrementPercent.toFixed(2),
  }).tiers.reduce((sum, tier) => sum + tier.price * (tier.ticketsTo - tier.ticketsFrom), 0);

describe('resolveTierLayout', () => {
  // Fewer tickets than rounds is reachable through the DTO (totalTickets is only
  // @IsPositive, priceTierCount allows up to 10), and used to emit rounds whose
  // ticketsFrom ran past ticketsTo — an inverted range that displayed as "3-1" and
  // counted negative in any sum over the tiers.
  it.each([
    [1, 10],
    [5, 10],
    [7, 5],
    [9, 4],
    [2, 3],
  ])('covers %i tickets over %i requested rounds without an empty or inverted round', (tickets, requested) => {
    const { ranges, totalTiers } = resolveTierLayout(tickets, requested);

    expect(totalTiers).toBe(ranges.length);
    expect(ranges.length).toBeGreaterThan(0);
    for (const range of ranges) {
      expect(range.ticketsTo).toBeGreaterThan(range.ticketsFrom);
    }
    expect(ranges.reduce((sum, r) => sum + (r.ticketsTo - r.ticketsFrom), 0)).toBe(tickets);
    expect(ranges[0].ticketsFrom).toBe(0);
    expect(ranges[ranges.length - 1].ticketsTo).toBe(tickets);
  });

  it('leaves the rounds contiguous', () => {
    const { ranges } = resolveTierLayout(100, 4);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].ticketsFrom).toBe(ranges[i - 1].ticketsTo);
    }
  });
});

describe('deriveBaseTicketPrice', () => {
  // The invariant the funding UI rests on: selling every ticket raises the goal, not
  // more. A base price of targetAmount / totalTickets ignores the per-round increase
  // and overshoots by 34% at the defaults.
  it.each([
    [5_000_000, 100, 4, 20],
    [8_000_000, 100, 4, 20],
    [3_000_000, 100, 4, 20],
    [1_234_567, 333, 7, 5],
    [100_000, 7, 3, 33.3],
    [250_000, 1, 1, 20],
  ])('selling out at the derived price raises the goal (%i over %i tickets)', (target, tickets, rounds, inc) => {
    const base = deriveBaseTicketPrice({
      targetAmount: target,
      totalTickets: tickets,
      priceTierCount: rounds,
      incrementPercent: inc,
    });

    // Only cent-rounding of the base price separates the two.
    expect(sellOutTotal(base, tickets, rounds, inc)).toBeCloseTo(target, -1);
  });

  it('is not the naive goal / tickets, because later rounds cost more', () => {
    const base = deriveBaseTicketPrice({
      targetAmount: 5_000_000,
      totalTickets: 100,
      priceTierCount: 4,
      incrementPercent: 20,
    });

    expect(base).toBeCloseTo(37_257.82, 2);
    // What the seed used to hardcode, and what it raised.
    expect(sellOutTotal(50_000, 100, 4, 20)).toBe(6_710_000);
  });

  it('flattens to goal / tickets when rounds do not escalate', () => {
    expect(
      deriveBaseTicketPrice({ targetAmount: 10_000, totalTickets: 100, priceTierCount: 4, incrementPercent: 0 }),
    ).toBe(100);
  });

  it('returns 0 for inputs that cannot be priced', () => {
    expect(deriveBaseTicketPrice({ targetAmount: 0, totalTickets: 100, priceTierCount: 4, incrementPercent: 20 })).toBe(
      0,
    );
    expect(deriveBaseTicketPrice({ targetAmount: 5_000, totalTickets: 0, priceTierCount: 4, incrementPercent: 20 })).toBe(
      0,
    );
  });
});

describe('computeTicketPricing', () => {
  const project = {
    ticketPrice: '37257.82',
    // 0 opts out of the last-round absorption, isolating the raw ladder.
    targetAmount: '0',
    totalTickets: 100,
    ticketsSold: 0,
    priceTierCount: 4,
    priceTierIncrementPercent: '20.00',
  };

  it('escalates each round by the increment', () => {
    const { tiers } = computeTicketPricing(project);
    expect(tiers.map((t) => t.price)).toEqual([37_257.82, 44_709.38, 53_651.26, 64_381.51]);
  });

  it('prices against the round the next ticket falls in', () => {
    expect(computeTicketPricing({ ...project, ticketsSold: 24 }).currentTier).toBe(0);
    expect(computeTicketPricing({ ...project, ticketsSold: 25 }).currentTier).toBe(1);
    // Sold out: stays on the last real round rather than running off the end.
    expect(computeTicketPricing({ ...project, ticketsSold: 100 }).currentTier).toBe(3);
  });

  it('keeps currentTier on a round that exists when tickets are scarcer than rounds', () => {
    const scarce = computeTicketPricing({ ...project, totalTickets: 3, priceTierCount: 10, ticketsSold: 3 });
    expect(scarce.currentTier).toBeLessThan(scarce.tiers.length);
    expect(scarce.currentTicketPrice).toBeGreaterThan(0);
  });
});

describe('last-round absorption', () => {
  // The reported symptom: a project that sold all 120,000 of its tickets displayed
  // 11,999,280 raised against a 12,000,000 goal, i.e. 99.99% funded while sold out.
  const nnnn = {
    ticketPrice: '79.50',
    targetAmount: '12000000.00',
    totalTickets: 120_000,
    ticketsSold: 0,
    priceTierCount: 10,
    priceTierIncrementPercent: '5.00',
  };

  it('makes a sell-out reach the goal exactly', () => {
    const { tiers } = computeTicketPricing(nnnn);
    const total = tiers.reduce((sum, t) => sum + t.price * (t.ticketsTo - t.ticketsFrom), 0);

    expect(total).toBe(12_000_000);
    // Without it, the accumulated cent-rounding leaves the project 720 short.
    expect(sellOutTotal(79.5, 120_000, 10, 5)).toBe(11_999_280);
  });

  it('only nudges the last round, leaving the earlier ones on the ladder', () => {
    const { tiers } = computeTicketPricing(nnnn);
    const bare = computeTicketPricing({ ...nnnn, targetAmount: '0' }).tiers;

    expect(tiers.slice(0, -1).map((t) => t.price)).toEqual(bare.slice(0, -1).map((t) => t.price));
    expect(tiers[9].price - bare[9].price).toBeCloseTo(0.06, 2);
  });

  it('refuses to absorb a gap too big to be rounding, so a stale base price is left visible', () => {
    // A goal of 5,000,000 with a hardcoded 50,000 base (what the seed used to do).
    // Absorbing here would drop round 4 from 86,400 to 18,000 — below round 1.
    const legacy = computeTicketPricing({
      ticketPrice: '50000.00',
      targetAmount: '5000000.00',
      totalTickets: 100,
      ticketsSold: 0,
      priceTierCount: 4,
      priceTierIncrementPercent: '20.00',
    });

    expect(legacy.tiers.map((t) => t.price)).toEqual([50_000, 60_000, 72_000, 86_400]);
  });

  // Exact whenever the goal in cents divides evenly by the last round's ticket count,
  // which covers a round goal over equal rounds. It can't always: 333 tickets over 7
  // rounds leaves 45 in the last round while the earlier ones hold 48, so the leftover
  // needn't be a whole number of cents per ticket. A round has one price, so the best a
  // cent-priced ladder can do is land within half a cent per last-round ticket. That
  // bound is fixed by the round's size, unlike the old error which grew with the
  // project: 720 short on 120,000 tickets.
  it.each([
    [12_000_000, 120_000, 10, 5, 0],
    [12_000_000, 100_000, 4, 5, 0],
    [5_000_000, 100, 4, 20, 0],
    [1_234_567, 333, 7, 5, 0.225],
  ])('sells out to the goal within the cent grid (%i over %i tickets)', (target, tickets, rounds, inc, allowed) => {
    const base = deriveBaseTicketPrice({
      targetAmount: target,
      totalTickets: tickets,
      priceTierCount: rounds,
      incrementPercent: inc,
    });

    const drift = Math.abs(sellOutTotal(base, tickets, rounds, inc, target) - target);
    expect(drift).toBeLessThanOrEqual(allowed);
  });
});

describe('computeTicketPurchaseCost', () => {
  const { tiers } = computeTicketPricing({
    ticketPrice: '100',
    targetAmount: '0',
    totalTickets: 100,
    ticketsSold: 0,
    priceTierCount: 4,
    priceTierIncrementPercent: '20.00',
  });

  it('charges each ticket at the round it lands in', () => {
    expect(computeTicketPurchaseCost(tiers, 0, 1)).toBe(100);
    expect(computeTicketPurchaseCost(tiers, 24, 2)).toBe(100 + 120);
    // 25 tickets in each of the four rounds. Written out rather than as
    // 25 * (100 + 120 + 144 + 172.8), which floats to 13419.999999999998 — the
    // rounding to cents inside computeTicketPurchaseCost is the point here.
    expect(computeTicketPurchaseCost(tiers, 0, 100)).toBe(13_420);
  });
});
