/**
 * The automatic "Bundle of three" offer (src/lib/commerce/offers.ts) and how the totals carry it.
 */
import { describe, expect, it } from "vitest";

import { CURRENT_OFFER, evaluateOffer, qualifies, type MultiBuyOffer } from "./offers";
import { computeTotals } from "./totals";
import type { CartLine, Coupon } from "./coupons";

const offer: MultiBuyOffer = { ...CURRENT_OFFER, active: true, minQuantity: 3, percent: 20, combinesWithCoupons: false };

const line = (key: string, unitPrice: number, quantity: number, categories: string[], name = key): CartLine => ({
  key,
  productId: 1,
  variationId: null,
  name,
  categories,
  onSale: false,
  unitPrice: BigInt(unitPrice) * 100n,
  quantity,
});
const vial = (key: string, price: number, qty = 1) => line(key, price, qty, ["vial", "healing-recovery"]);
const pen = (key: string, price: number, qty = 1) => line(key, price, qty, ["pen-peptides"]);
const spray = (key: string, price: number, qty = 1) => line(key, price, qty, ["nasal-spray-peptides"]);
const bacWater = (qty = 1) => line("bac", 200_000, qty, ["vial", "supplies"], "Bacteriostatic BAC Water 10ml");
const bundle = (qty = 1) => line("bundle", 4_080_000, qty, ["bundles"], "Bali Glow Bundle");
const service = () => line("service", 100_000, 1, ["other", "pen-peptides"], "Reconstitution Service for Disposable Peptide Pens");

const tenPercent: Coupon = {
  code: "save10",
  type: "percent",
  amount: "10",
  expiresAt: null,
  usageLimit: null,
  usageCount: 0,
  usageLimitPerUser: null,
  individualUse: false,
  freeShipping: false,
  minimumAmount: null,
  maximumAmount: null,
  excludeSaleItems: false,
  productIds: [],
  excludedProductIds: [],
  categorySlugs: [],
  excludedCategorySlugs: [],
  emailRestrictions: [],
  limitUsageToXItems: null,
};

describe("which products count", () => {
  it("counts peptides in vials, pens and nasal sprays only", () => {
    expect(qualifies(vial("a", 1), offer)).toBe(true);
    expect(qualifies(pen("a", 1), offer)).toBe(true);
    expect(qualifies(spray("a", 1), offer)).toBe(true);
    expect(qualifies(bacWater(), offer)).toBe(false);
    expect(qualifies(bundle(), offer)).toBe(false);
    expect(qualifies(service(), offer)).toBe(false);
    expect(qualifies(line("stack", 1, 1, ["peptide-protocols"]), offer)).toBe(false);
  });
});

describe("evaluateOffer", () => {
  it("counts quantities and shows what is still needed", () => {
    const one = evaluateOffer([vial("a", 850_000), bacWater(3)], { offer })!;
    expect(one).toMatchObject({ qualifyingQuantity: 1, remaining: 2, reached: false, amount: 0n });
    const three = evaluateOffer([vial("a", 850_000, 3)], { offer })!;
    expect(three).toMatchObject({ qualifyingQuantity: 3, remaining: 0, reached: true });
    expect(three.amount).toBe(51_000_000n); // 20% of Rp 2,550,000
  });

  it("takes 20% off every qualifying line once reached, never the excluded ones", () => {
    const state = evaluateOffer([vial("a", 850_000), pen("b", 1_200_000), spray("c", 1_400_000), bacWater(), bundle()], { offer })!;
    expect([...state.perLine.keys()]).toEqual(["a", "b", "c"]);
    expect(state.perLine.get("a")).toBe(17_000_000n);
    expect(state.amount).toBe(69_000_000n); // 20% of Rp 3,450,000
  });

  it("waits while a coupon is applied, unless the offer combines with coupons", () => {
    const lines = [vial("a", 850_000, 3)];
    expect(evaluateOffer(lines, { offer, couponApplied: true })).toMatchObject({ reached: true, blockedByCoupon: true, amount: 0n });
    const combined = evaluateOffer(lines, { offer: { ...offer, combinesWithCoupons: true }, couponApplied: true, taken: new Map([["a", 255_000_000n - 10n]]) })!;
    expect(combined.amount).toBe(10n); // capped: the line can't go below zero
  });

  it("is off when no offer runs", () => {
    expect(evaluateOffer([vial("a", 1, 5)], { offer: null })).toBeNull();
    expect(evaluateOffer([vial("a", 1, 5)], { offer: { ...offer, active: false } })).toBeNull();
  });
});

describe("computeTotals with the offer", () => {
  it("puts the offer in the discount, the line discounts and the cart amount", () => {
    const totals = computeTotals({ lines: [vial("a", 850_000), pen("b", 1_200_000), bacWater()], offer });
    expect(totals.offer?.reached).toBe(false);
    expect(totals.discount).toBe(0n);
    const reached = computeTotals({ lines: [vial("a", 850_000, 2), pen("b", 1_200_000), bacWater()], offer });
    expect(reached.discount).toBe(58_000_000n); // 20% of Rp 2,900,000
    expect(reached.lineDiscounts.get("a")).toBe(34_000_000n);
    expect(reached.lineDiscounts.has("bac")).toBe(false);
    expect(reached.cartAmount).toBe(reached.subtotal - 58_000_000n);
  });

  it("keeps a coupon's discount and no offer when a coupon is applied", () => {
    const totals = computeTotals({ lines: [vial("a", 850_000, 3)], coupons: [tenPercent], offer });
    expect(totals.offer?.blockedByCoupon).toBe(true);
    expect(totals.discount).toBe(25_500_000n); // the coupon's 10% only
  });

  it("changes nothing for callers that don't pass an offer", () => {
    const totals = computeTotals({ lines: [vial("a", 850_000, 3)] });
    expect(totals.offer).toBeNull();
    expect(totals.discount).toBe(0n);
  });
});
