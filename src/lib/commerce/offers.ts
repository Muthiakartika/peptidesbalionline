/**
 * The automatic offer the shop is running (the owner, 13 Nov 2026: a checkout card "which will reflect
 * the offer we are running at the time"; the user chose a real automatic discount). Today:
 *
 *   "Bundle of three": mix any 3 or more qualifying products (quantities count: 3 × the same vial
 *   counts) and every qualifying product in the cart is 20% off.
 *
 * Qualifying: a peptide in vials, pens or nasal sprays. Not: supplies (BAC water, syringes, needles,
 * cases), the reconstitution services, and bundles and protocol stacks (already discounted). By
 * default the offer doesn't combine with coupon codes: while a coupon is applied the offer waits.
 *
 * To change or stop the offer, edit CURRENT_OFFER below (active: false hides the cards and the
 * discount everywhere). Amounts are minor units, rounded half up per line like the payment fees.
 * Used by computeTotals (totals.ts), the cart and checkout totals and OfferCard.
 */
import type { CartLine } from "./coupons";
import { percentOf } from "./totals";

export type MultiBuyOffer = {
  active: boolean;
  /** Shown as the card's label and the discount line, e.g. "Bundle of three". */
  name: string;
  /** Qualifying items needed (quantities count). */
  minQuantity: number;
  percent: number;
  /** A product counts when it is in one of these categories (parents count, as in CartLine)… */
  formats: string[];
  /** …and in none of these… */
  excludedCategories: string[];
  /** …and its name doesn't match this. */
  excludedNames: RegExp;
  /** Shown under the card. */
  excludedNote: string;
  combinesWithCoupons: boolean;
};

export const CURRENT_OFFER: MultiBuyOffer = {
  active: true,
  name: "Bundle of three",
  minQuantity: 3,
  percent: 20,
  formats: ["vial", "pen-peptides", "nasal-spray-peptides"],
  excludedCategories: ["supplies", "bundles", "peptide-protocols"],
  excludedNames: /^reconstitution service/i,
  excludedNote: "Bacteriostatic water and other supplies, reconstitution services, bundles and protocol stacks don't count and aren't discounted.",
  combinesWithCoupons: false,
};

export type OfferState = {
  offer: MultiBuyOffer;
  /** Items in the cart that count towards the offer. */
  qualifyingQuantity: number;
  /** Items still needed (0 once reached). */
  remaining: number;
  reached: boolean;
  /** Reached, but a coupon is applied and the offer doesn't combine with coupons. */
  blockedByCoupon: boolean;
  /** Line key → discount (empty unless the offer applies). */
  perLine: Map<string, bigint>;
  amount: bigint;
};

type OfferLine = Pick<CartLine, "key" | "name" | "categories" | "unitPrice" | "quantity">;

/** Whether a product counts towards the offer and gets its discount. */
export function qualifies(line: Pick<CartLine, "name" | "categories">, offer: MultiBuyOffer = CURRENT_OFFER): boolean {
  if (!line.categories.some((slug) => offer.formats.includes(slug))) return false;
  if (line.categories.some((slug) => offer.excludedCategories.includes(slug))) return false;
  return !offer.excludedNames.test(line.name.trim());
}

/**
 * The offer for a cart. `couponApplied`: a coupon is on the cart. `taken`: what coupons already take
 * off each line (a line never goes below zero when the offer combines with coupons).
 */
export function evaluateOffer(lines: OfferLine[], { offer = CURRENT_OFFER, couponApplied = false, taken = new Map<string, bigint>() }: { offer?: MultiBuyOffer | null; couponApplied?: boolean; taken?: Map<string, bigint> } = {}): OfferState | null {
  if (!offer?.active) return null;
  const qualifying = lines.filter((line) => qualifies(line, offer));
  const qualifyingQuantity = qualifying.reduce((sum, line) => sum + line.quantity, 0);
  const reached = qualifyingQuantity >= offer.minQuantity;
  const blockedByCoupon = reached && couponApplied && !offer.combinesWithCoupons;
  const perLine = new Map<string, bigint>();
  if (reached && !blockedByCoupon) {
    for (const line of qualifying) {
      const lineTotal = line.unitPrice * BigInt(line.quantity);
      const left = lineTotal - (taken.get(line.key) ?? 0n);
      const amount = percentOf(lineTotal, offer.percent);
      const capped = amount > left ? left : amount;
      if (capped > 0n) perLine.set(line.key, capped);
    }
  }
  const amount = [...perLine.values()].reduce((sum, value) => sum + value, 0n);
  return { offer, qualifyingQuantity, remaining: Math.max(0, offer.minQuantity - qualifyingQuantity), reached, blockedByCoupon, perLine, amount };
}
