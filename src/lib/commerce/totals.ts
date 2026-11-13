/**
 * The cart and checkout totals, as the live shop works them out (WooCommerce + the owner's snippets,
 * docs/audit/backend-settings.md §2–§3). All amounts are minor units; no floating point anywhere.
 *
 *   subtotal            sum of unit price × quantity (no tax: taxes are off)
 *   discount            the applied coupons (coupons.ts) and the automatic offer (offers.ts: "Bundle of
 *                       three", 3+ qualifying items → 20% off them; waits while a coupon is applied)
 *   cart amount         subtotal − discount ("cart contents total"): the base for free shipping, the
 *                       card fee and the card / COD minimums
 *   shipping            Indonesia only: "Shipping" Rp 100,000; once the cart amount is Rp 2,500,000 or
 *                       more ONLY "Free shipping" is offered (live hides the paid one then: captured
 *                       6 Nov 2026, docs/audit/visual-reference/markup/, Q-51)
 *   payment             only once a method is chosen: on the checkout the chosen method if it is open, else
 *                       the first open one (`preselectPayment`; live preselects Card, or Crypto when Card
 *                       is locked). The cart page has none, so no card fee there (live, 6 Nov 2026)
 *   payment adjustment  that method's fee (card +5%) or discount, on the cart amount, rounded half up
 *   total               cart amount + shipping + adjustment
 */
import { couponDiscounts, type CartLine, type Coupon } from "./coupons";
import { evaluateOffer, type MultiBuyOffer, type OfferState } from "./offers";
import { paymentMethods, shipping, type PaymentMethod, type PaymentMethodId } from "./store-settings";

export type ShippingOption = { id: "flat_rate" | "free_shipping"; rateId: string; title: string; cost: bigint };

export type PaymentOption = PaymentMethod & {
  /** False when the cart amount is below the method's minimum (shown, but can't be used). */
  available: boolean;
  /** When locked: the title and text the checkout shows on the method (store-settings.ts). */
  locked?: { title: string; text: string; error: string };
};

export type Totals = {
  subtotal: bigint;
  /** Coupon code → its discount (all lines). */
  couponTotals: Map<string, bigint>;
  /** Line key → the discount on that line (all coupons and the offer). */
  lineDiscounts: Map<string, bigint>;
  /** The automatic offer: progress, and what it takes off (null when none is running). */
  offer: OfferState | null;
  /** Coupons + offer. */
  discount: bigint;
  cartAmount: bigint;
  shippingOptions: ShippingOption[];
  shipping: ShippingOption | null;
  paymentOptions: PaymentOption[];
  payment: PaymentOption | null;
  /** Positive = fee, negative = discount; 0 when the method has none. */
  paymentAdjustment: { label: string; amount: bigint } | null;
  total: bigint;
};

export type TotalsInput = {
  lines: CartLine[];
  coupons?: Coupon[];
  /** ISO country of the shipping address; null before the customer has entered one (cart page). */
  country?: string | null;
  shippingId?: string | null;
  paymentId?: PaymentMethodId | null;
  /** The checkout: fall back to the first open method when none (or a locked one) is chosen. */
  preselectPayment?: boolean;
  /** The methods offered (default: the live list). Online providers can be left out until they work. */
  methods?: readonly PaymentMethod[];
  /** The automatic offer to apply (offers.ts CURRENT_OFFER); none when left out. */
  offer?: MultiBuyOffer | null;
};

/** a × percent / 100, rounded half up (WooCommerce rounds fees to the store's 2 decimals). */
export function percentOf(amount: bigint, percent: number): bigint {
  if (!Number.isInteger(percent * 100)) throw new RangeError(`Unsupported percent: ${percent}`);
  const scaled = amount * BigInt(Math.round(percent * 100));
  return (scaled * 2n + 10_000n) / 20_000n;
}

export function computeTotals({ lines, coupons = [], country = "ID", shippingId = null, paymentId = null, preselectPayment = false, methods = paymentMethods, offer: offerSetting = null }: TotalsInput): Totals {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * BigInt(line.quantity), 0n);
  const perCoupon = couponDiscounts(coupons, lines);
  const couponTotals = new Map<string, bigint>();
  const lineDiscounts = new Map<string, bigint>();
  for (const [code, perLine] of perCoupon) {
    let total = 0n;
    for (const [key, amount] of perLine) {
      total += amount;
      lineDiscounts.set(key, (lineDiscounts.get(key) ?? 0n) + amount);
    }
    couponTotals.set(code, total);
  }
  const couponDiscount = [...couponTotals.values()].reduce((sum, amount) => sum + amount, 0n);
  // The automatic offer, after the coupons (a line never goes below zero).
  const offer = evaluateOffer(lines, { offer: offerSetting, couponApplied: coupons.length > 0, taken: new Map(lineDiscounts) });
  for (const [key, amount] of offer?.perLine ?? []) lineDiscounts.set(key, (lineDiscounts.get(key) ?? 0n) + amount);
  const discount = couponDiscount + (offer?.amount ?? 0n);
  const cartAmount = subtotal - discount;

  // Shipping: only to Indonesia (no other zone has a method). Before an address is known WooCommerce
  // uses the store's country (Indonesia), so the cart page shows the same options.
  const shipsHere = country === null || (shipping.countries as readonly string[]).includes(country);
  const shippingOptions: ShippingOption[] = [];
  if (shipsHere && lines.length) {
    if (cartAmount >= shipping.freeShipping.minAmount) {
      shippingOptions.push({ id: "free_shipping", rateId: shipping.freeShipping.rateId, title: shipping.freeShipping.title, cost: 0n });
    } else {
      shippingOptions.push({ id: "flat_rate", rateId: shipping.flatRate.rateId, title: shipping.flatRate.title, cost: shipping.flatRate.cost });
    }
  }
  const chosenShipping = shippingOptions.find((option) => option.id === shippingId) ?? shippingOptions[0] ?? null;

  const paymentOptions: PaymentOption[] = methods.map((method) => {
    const minimum = method.minimum;
    if (!minimum || cartAmount >= minimum.amount) return { ...method, available: true };
    return { ...method, available: false, locked: { title: minimum.lockTitle, text: minimum.lockText(cartAmount), error: minimum.error } };
  });
  const chosen = paymentOptions.find((option) => option.id === paymentId && option.available) ?? null;
  const payment = chosen ?? (preselectPayment ? (paymentOptions.find((option) => option.available) ?? null) : null);

  let paymentAdjustment: Totals["paymentAdjustment"] = null;
  if (payment?.adjustment && cartAmount > 0n) {
    const { type, percent, label } = payment.adjustment;
    const amount = percentOf(cartAmount, percent);
    paymentAdjustment = type === "fee" ? { label: `${label} (${percent}%)`, amount } : { label: `${label} discount (${percent}%)`, amount: -amount };
  }

  const total = cartAmount + (chosenShipping?.cost ?? 0n) + (paymentAdjustment?.amount ?? 0n);
  return { subtotal, couponTotals, lineDiscounts, offer, discount, cartAmount, shippingOptions, shipping: chosenShipping, paymentOptions, payment, paymentAdjustment, total };
}
