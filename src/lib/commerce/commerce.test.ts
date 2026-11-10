/**
 * The live shop's money rules (docs/audit/backend-settings.md): coupons as WooCommerce counts them,
 * shipping, the card fee and the payment minimums. Amounts in minor units: Rp 1 = 100n.
 */
import { describe, expect, it } from "vitest";

import { applyCoupon, checkCouponForCustomer, couponDiscounts, type CartLine, type Coupon } from "./coupons";
import { computeTotals } from "./totals";

const rp = (rupiah: number) => BigInt(rupiah) * 100n;

const line = (key: string, rupiah: number, quantity = 1, extra: Partial<CartLine> = {}): CartLine => ({
  key,
  productId: Number(key.replace(/\D/g, "")) || 1,
  variationId: null,
  name: `Product ${key}`,
  categories: ["vial"],
  onSale: false,
  unitPrice: rp(rupiah),
  quantity,
  ...extra,
});

const coupon = (code: string, extra: Partial<Coupon>): Coupon => ({
  code,
  type: "percent",
  amount: "10.00",
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
  ...extra,
});

// The kinds of coupons the live shop has (§7; codes are made up here).
const welcome5 = coupon("welcome5", { amount: "5.00", minimumAmount: rp(800_000), usageLimitPerUser: 1, individualUse: true, excludedProductIds: [99] });
const friend = coupon("friend-test", { type: "fixed_cart", amount: "250000.00", minimumAmount: rp(2_500_000), usageLimit: 1, usageLimitPerUser: 1, individualUse: true, expiresAt: new Date("2027-01-28T19:53:13Z") });
const freeOrder = coupon("free-test", { type: "fixed_cart", amount: "100000000.00", freeShipping: true });
const now = new Date("2026-11-06T12:00:00Z");

describe("coupons", () => {
  it("checks a coupon the way WooCommerce does, with its texts", () => {
    const small = [line("p1", 500_000)];
    expect(applyCoupon(undefined, "NOPE", small, [])).toEqual({ ok: false, error: 'Coupon "nope" cannot be applied because it does not exist.' });
    expect(applyCoupon(welcome5, "welcome5", small, [], { now })).toEqual({ ok: false, error: 'The minimum spend for coupon "welcome5" is Rp800,000.00.' });
    expect(applyCoupon(coupon("old", { expiresAt: new Date("2026-01-01") }), "old", small, [], { now })).toEqual({ ok: false, error: 'Coupon "old" has expired.' });
    expect(applyCoupon(coupon("used", { usageLimit: 1, usageCount: 1 }), "used", small, [], { now })).toEqual({ ok: false, error: 'Usage limit for coupon "used" has been reached.' });
    expect(applyCoupon(coupon("max", { maximumAmount: rp(100_000) }), "max", small, [], { now })).toEqual({ ok: false, error: 'The maximum spend for coupon "max" is Rp100,000.00.' });
    // Only an excluded product in the cart: nothing to discount.
    expect(applyCoupon(welcome5, "welcome5", [line("p99", 900_000)], [], { now })).toEqual({ ok: false, error: 'Sorry, coupon "welcome5" is not applicable to selected products.' });
    // A logged-in customer who used it up, and "Allowed emails" before the checkout knows an e-mail.
    expect(applyCoupon(welcome5, "welcome5", [line("p1", 900_000)], [], { now, timesUsedByUser: 1 })).toEqual({ ok: false, error: 'Usage limit for coupon "welcome5" has been reached.' });
    expect(applyCoupon(coupon("vip", { emailRestrictions: ["*@example.com"] }), "vip", small, [], { now, emails: [] })).toEqual({ ok: false, error: 'Please enter a valid email at checkout to use coupon code "vip".' });
  });

  it("handles individual use like WooCommerce: a new one replaces the others, nothing joins it", () => {
    const cart = [line("p1", 3_000_000)];
    const thanks = coupon("thanks10", { minimumAmount: rp(800_000) });
    const withThanks = applyCoupon(thanks, "thanks10", cart, [], { now });
    expect(withThanks.ok && withThanks.applied.map((c) => c.code)).toEqual(["thanks10"]);
    const replaced = applyCoupon(friend, "friend-test", cart, withThanks.ok ? withThanks.applied : [], { now });
    expect(replaced.ok && replaced.applied.map((c) => c.code)).toEqual(["friend-test"]);
    expect(applyCoupon(thanks, "thanks10", cart, [friend], { now })).toEqual({ ok: false, error: 'Sorry, coupon "friend-test" has already been applied and cannot be used in conjunction with other coupons.' });
    expect(applyCoupon(thanks, "thanks10", cart, [thanks], { now })).toEqual({ ok: false, error: 'Coupon code "thanks10" already applied!' });
  });

  it("lists excluded products and categories for cart coupons", () => {
    const cartCoupon = coupon("cart", { type: "fixed_cart", amount: "50000.00", excludedProductIds: [7], excludedCategorySlugs: ["pens"] });
    expect(applyCoupon(cartCoupon, "cart", [line("p1", 100_000), line("p7", 100_000, 1, { name: "BPC-157" })], [], { now })).toEqual({ ok: false, error: 'Sorry, coupon "cart" is not applicable to the products: BPC-157.' });
    expect(applyCoupon(cartCoupon, "cart", [line("p2", 100_000, 1, { categories: ["pens"] })], [], { now, categoryName: () => "Pen Peptides" })).toEqual({ ok: false, error: 'Sorry, coupon "cart" is not applicable to the categories: Pen Peptides.' });
  });

  it("rounds a percentage for the whole cart and gives the extra cent to the most expensive item", () => {
    // 10% of Rp 3.33 + Rp 3.33 + Rp 3.34 = Rp 1.00; per line only 33 + 33 + 33 cents, so 1 cent more.
    const lines = [line("a", 0, 1, { unitPrice: 333n }), line("b", 0, 1, { unitPrice: 333n }), line("c", 0, 1, { unitPrice: 334n })];
    const discounts = couponDiscounts([coupon("ten", {})], lines).get("ten")!;
    expect([...discounts.values()].reduce((a, b) => a + b, 0n)).toBe(100n);
    expect(discounts.get("c")).toBe(34n);
  });

  it("never discounts a line below zero, even with several coupons", () => {
    const lines = [line("p1", 100_000)];
    const totals = computeTotals({ lines, coupons: [coupon("a", { amount: "80.00" }), coupon("b", { amount: "50.00" })] });
    expect(totals.couponTotals.get("a")).toBe(rp(80_000));
    expect(totals.couponTotals.get("b")).toBe(rp(20_000));
    expect(totals.cartAmount).toBe(0n);
  });

  it("checks the per-customer limit and e-mail restrictions at checkout", () => {
    expect(checkCouponForCustomer(welcome5, { emails: ["a@example.com"], guest: true, timesUsedByEmail: 1 })).toEqual({ ok: false, error: 'Usage limit for coupon "welcome5" has been reached.', remove: false });
    expect(checkCouponForCustomer(welcome5, { emails: ["a@example.com"], guest: true, timesUsedByEmail: 0 })).toEqual({ ok: true });
    // A logged-in customer's limit was checked by account when the coupon was applied.
    expect(checkCouponForCustomer(welcome5, { emails: ["a@example.com"], guest: false, timesUsedByEmail: 5 })).toEqual({ ok: true });
    const restricted = coupon("vip", { emailRestrictions: ["*@example.com"] });
    expect(checkCouponForCustomer(restricted, { emails: ["Someone@Example.com"], guest: true, timesUsedByEmail: 0 })).toEqual({ ok: true });
    expect(checkCouponForCustomer(restricted, { emails: ["someone@other.com"], guest: true, timesUsedByEmail: 0 })).toEqual({ ok: false, error: 'Please enter a valid email to use coupon code "vip".', remove: true });
  });
});

describe("totals", () => {
  it("charges Rp 100,000 shipping, and only free shipping from Rp 2,500,000 after coupons", () => {
    expect(computeTotals({ lines: [line("p1", 2_499_999)] }).shippingOptions.map((o) => o.id)).toEqual(["flat_rate"]);
    // Live offers only free shipping then (captured 6 Nov 2026: one shipping input, free_shipping:2).
    const enough = computeTotals({ lines: [line("p1", 2_500_000)], shippingId: "flat_rate" });
    expect(enough.shippingOptions.map((o) => o.id)).toEqual(["free_shipping"]);
    expect(enough.shipping?.id).toBe("free_shipping");
    // The cart page: no payment method chosen yet, so no card fee (live cart, 6 Nov 2026).
    expect(enough.payment).toBeNull();
    expect(enough.total).toBe(rp(2_500_000));
    // A coupon that brings the cart under Rp 2,500,000 takes free shipping away.
    const thanks = coupon("thanks10", {});
    expect(computeTotals({ lines: [line("p1", 2_600_000)], coupons: [thanks] }).shippingOptions.map((o) => o.id)).toEqual(["flat_rate"]);
    // No other country can be shipped to.
    expect(computeTotals({ lines: [line("p1", 2_600_000)], country: "SG" }).shippingOptions).toEqual([]);
  });

  it("adds the card's 5% on the cart amount, and locks card under Rp 2,000,000 and COD under Rp 2,500,000", () => {
    const card = computeTotals({ lines: [line("p1", 2_000_000)], paymentId: "atlas_card" });
    expect(card.paymentAdjustment).toEqual({ label: "Card adjustment (5%)", amount: rp(100_000) });
    expect(card.total).toBe(rp(2_200_000)); // 2,000,000 + 100,000 shipping + 100,000 card
    const small = computeTotals({ lines: [line("p1", 1_500_000)] });
    expect(small.paymentOptions.find((o) => o.id === "atlas_card")).toMatchObject({
      available: false,
      locked: { title: "🔒 Card payment unavailable", text: "Available for orders of Rp2,000,000 or more. Add Rp500,000 more to enable.", error: "Card payment requires a minimum order of Rp2,000,000." },
    });
    expect(small.paymentOptions.find((o) => o.id === "cod")).toMatchObject({ available: false, locked: { title: "🔒 Cash on Delivery unavailable", text: "Available for orders above Rp2,500,000" } });
    expect(computeTotals({ lines: [line("p1", 2_500_000)] }).paymentOptions.find((o) => o.id === "cod")?.available).toBe(true);
    expect(small.paymentOptions.filter((o) => o.available).map((o) => o.id)).toEqual(["nowpayments_gateway", "sleeks_revolut", "sleeks_wise", "atlas_idr_account", "payram", "bitbridge-pay-gateway-hosted"]);
  });

  it("preselects the first open payment method, as the live checkout does", () => {
    // Captured 6 Nov 2026: Rp 2,800,000 → Card checked (+Rp 140,000); Rp 1,200,000 → Card and COD disabled, Crypto checked.
    const large = computeTotals({ lines: [line("p1", 2_800_000)], preselectPayment: true });
    expect(large.payment?.id).toBe("atlas_card");
    expect(large.paymentAdjustment?.amount).toBe(rp(140_000));
    expect(large.total).toBe(rp(2_940_000));
    const small = computeTotals({ lines: [line("p1", 1_200_000)], paymentId: "atlas_card", preselectPayment: true });
    expect(small.payment?.id).toBe("nowpayments_gateway");
    expect(small.paymentAdjustment).toBeNull();
    expect(small.total).toBe(rp(1_300_000));
  });

  it("works out the live coupons: 5% welcome, Rp 250,000 refer-a-friend, and the free-order coupon", () => {
    const welcome = computeTotals({ lines: [line("p1", 850_000), line("p2", 1_200_000)], coupons: [welcome5] });
    expect(welcome.discount).toBe(rp(102_500));
    expect(welcome.total).toBe(rp(2_050_000 - 102_500 + 100_000));
    const friendTotals = computeTotals({ lines: [line("p1", 1_000_000, 3)], coupons: [friend], shippingId: "free_shipping" });
    expect(friendTotals.discount).toBe(rp(250_000));
    expect(friendTotals.shipping?.id).toBe("free_shipping"); // 2,750,000 after the coupon
    // The free-order coupon: the cart amount becomes 0, so free shipping (needs Rp 2,500,000) is gone and
    // its "free shipping" flag does nothing (live's free shipping only looks at the amount).
    const free = computeTotals({ lines: [line("p1", 3_000_000)], coupons: [freeOrder] });
    expect(free.cartAmount).toBe(0n);
    expect(free.total).toBe(rp(100_000));
  });
});
