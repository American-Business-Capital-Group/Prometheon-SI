/**
 * The A6 commercial card (Development Master List & Strategy, rule A6).
 * These figures are the published card. Usage is billed at landed
 * supplier cost x 1.35 on every tier; the $25 minimum wallet top-up and
 * the 15% annual platform prepayment discount are card terms. Usage is
 * never discounted. Consumer tier names (S-20) are NOT published until
 * Jon decides that step; this card is what the site ships.
 */

export interface Tier {
  id: string;
  name: string;
  blurb: string;
  /** Monthly platform charge in USD for the minimum seat count. */
  monthlyPlatformUsd: number;
  /** Per-seat monthly price, or null for a flat account price. */
  perSeatUsd: number | null;
  /** Flat platform fee component (Enterprise), USD/month. */
  platformFeeUsd: number | null;
  minSeats: number;
  priceNote: string;
}

export const TIERS: Tier[] = [
  {
    id: "individual",
    name: "Individual",
    blurb: "For individual power users running serious work through one account.",
    monthlyPlatformUsd: 29,
    perSeatUsd: null,
    platformFeeUsd: null,
    minSeats: 1,
    priceNote: "$29/mo per account",
  },
  {
    id: "team",
    name: "Team",
    blurb: "For professional knowledge teams and software teams working in one workspace.",
    monthlyPlatformUsd: 49 * 5,
    perSeatUsd: 49,
    platformFeeUsd: null,
    minSeats: 5,
    priceNote: "$49/seat/mo, minimum 5 seats",
  },
  {
    id: "business",
    name: "Business",
    blurb: "For larger teams that need administration, controls, and priority support.",
    monthlyPlatformUsd: 99 * 10,
    perSeatUsd: 99,
    platformFeeUsd: null,
    minSeats: 10,
    priceNote: "$99/seat/mo, minimum 10 seats",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "For organizations buying a platform commitment with a named data boundary.",
    monthlyPlatformUsd: 2500 + 79 * 25,
    perSeatUsd: 79,
    platformFeeUsd: 2500,
    minSeats: 25,
    priceNote: "$2,500/mo platform + $79/seat/mo, minimum 25 seats",
  },
];

export const USAGE_MARKUP = 1.35;
export const MIN_TOPUP_USD = 25;
export const ANNUAL_PLATFORM_DISCOUNT = 0.15;

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

/** Platform charge in cents for a Checkout session. Annual billing
 * prepays 12 months of platform charges with the 15% platform
 * prepayment discount applied. Usage is never part of this charge. */
export function platformChargeCents(
  tier: Tier,
  seats: number,
  billing: "monthly" | "annual",
): number {
  const s = Math.max(seats, tier.minSeats);
  let monthly: number;
  if (tier.id === "individual") monthly = tier.monthlyPlatformUsd;
  else if (tier.platformFeeUsd !== null)
    monthly = tier.platformFeeUsd + (tier.perSeatUsd ?? 0) * s;
  else monthly = (tier.perSeatUsd ?? 0) * s;
  if (billing === "monthly") return Math.round(monthly * 100);
  return Math.round(monthly * 12 * (1 - ANNUAL_PLATFORM_DISCOUNT) * 100);
}
