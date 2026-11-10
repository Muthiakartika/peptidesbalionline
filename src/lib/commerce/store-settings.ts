/**
 * The live shop's commerce settings, read in wp-admin on 6 Nov 2026 (docs/audit/backend-settings.md).
 * Amounts are minor units (Rp 1.00 = 100n, see src/lib/money.ts). Phase 5 keeps them here as code;
 * the admin screens can move them to the database later without changing the rules that use them.
 */

/** Rp → minor units, for readability below. */
const rp = (rupiah: number) => BigInt(rupiah) * 100n;

/** Whole rupiah with "," thousands (WordPress's number_format_i18n in English): 200000000n → "2,000,000". */
const thousands = (minor: bigint) => (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Shipping zone "Indonesia" (the only zone; other countries can't order). §2 */
export const shipping = {
  countries: ["ID"] as const,
  /** Where WooCommerce ships to before the customer gives an address: the store's base (Bali). */
  defaultState: "BA",
  // rateId: WooCommerce's "<method>:<instance>" in the zone, as in the live forms (shipping_method[0]).
  flatRate: { id: "flat_rate", rateId: "flat_rate:1", title: "Shipping", cost: rp(100_000) },
  /** Free from this cart amount, counted after coupon discounts ("ignore_discounts: no"). */
  freeShipping: { id: "free_shipping", rateId: "free_shipping:2", title: "Free shipping", minAmount: rp(2_500_000) },
} as const;

/** Indonesia's provinces as WooCommerce lists them (code → name), in its order (live cart's form). */
export const indonesiaStates: readonly (readonly [string, string])[] = [
  ["AC", "Daerah Istimewa Aceh"], ["SU", "Sumatera Utara"], ["SB", "Sumatera Barat"], ["RI", "Riau"], ["KR", "Kepulauan Riau"],
  ["JA", "Jambi"], ["SS", "Sumatera Selatan"], ["BB", "Bangka Belitung"], ["BE", "Bengkulu"], ["LA", "Lampung"],
  ["JK", "DKI Jakarta"], ["JB", "Jawa Barat"], ["BT", "Banten"], ["JT", "Jawa Tengah"], ["JI", "Jawa Timur"],
  ["YO", "Daerah Istimewa Yogyakarta"], ["BA", "Bali"], ["NB", "Nusa Tenggara Barat"], ["NT", "Nusa Tenggara Timur"],
  ["KB", "Kalimantan Barat"], ["KT", "Kalimantan Tengah"], ["KI", "Kalimantan Timur"], ["KS", "Kalimantan Selatan"],
  ["KU", "Kalimantan Utara"], ["SA", "Sulawesi Utara"], ["ST", "Sulawesi Tengah"], ["SG", "Sulawesi Tenggara"],
  ["SR", "Sulawesi Barat"], ["SN", "Sulawesi Selatan"], ["GO", "Gorontalo"], ["MA", "Maluku"], ["MU", "Maluku Utara"],
  ["PA", "Papua"], ["PB", "Papua Barat"],
];

export type PaymentMethodId =
  | "atlas_card"
  | "nowpayments_gateway"
  | "sleeks_revolut"
  | "sleeks_wise"
  | "atlas_idr_account"
  | "payram"
  | "bitbridge-pay-gateway-hosted"
  | "cod";

export type PaymentMethod = {
  id: PaymentMethodId;
  /** The title the checkout shows. */
  title: string;
  /** How the order is paid: by hand after the order (manual), or online through a provider. */
  kind: "manual" | "online";
  /** Order status right after "Place order" (online: until the provider confirms). */
  statusAfterOrder: "on-hold" | "pending" | "processing";
  /**
   * Minimum cart amount (after coupons, before shipping). Below it the method is shown locked with
   * `lockTitle` + `lockText`, and placing the order with it fails with `error` (the owner's snippets).
   */
  minimum?: { amount: bigint; lockTitle: string; lockText: (cartAmount: bigint) => string; error: string };
  /** Percent added (fee) or taken off (discount) from the cart amount when this method is chosen. */
  adjustment?: { type: "fee" | "discount"; percent: number; label: string };
  /** The gateway's "instructions" setting, printed on the thank-you page (read in wp-admin, 7 Nov 2026). */
  instructions?: string;
};

const CARD_MINIMUM = rp(2_000_000);
const COD_MINIMUM = rp(2_500_000);

/**
 * The enabled payment methods, in checkout order (§3). Online providers (NOWPayments, PayRam,
 * BitBridge Pay) are only switched on once their sandbox works (Q-01, Q-49).
 */
export const paymentMethods: readonly PaymentMethod[] = [
  // Snippet "Card Payment Minimum Rp200,000" enforces Rp 2,000,000 in its code (Q-46); the code is what runs.
  {
    id: "atlas_card",
    title: "Card",
    kind: "manual",
    statusAfterOrder: "on-hold",
    minimum: {
      amount: CARD_MINIMUM,
      lockTitle: "🔒 Card payment unavailable",
      // The snippet rounds the missing rupiah up and prints whole rupiah.
      lockText: (cartAmount) => {
        const missing = ((CARD_MINIMUM - cartAmount + 99n) / 100n) * 100n;
        return `Available for orders of Rp${thousands(CARD_MINIMUM)} or more.${missing > 0n ? ` Add Rp${thousands(missing)} more to enable.` : ""}`;
      },
      error: `Card payment requires a minimum order of Rp${thousands(CARD_MINIMUM)}.`,
    },
    adjustment: { type: "fee", percent: 5, label: "Card adjustment" },
  },
  { id: "nowpayments_gateway", title: "Crypto", kind: "online", statusAfterOrder: "pending" },
  {
    id: "sleeks_revolut",
    title: "Revolut",
    kind: "manual",
    statusAfterOrder: "on-hold",
    instructions:
      "Your order will be created as Pending Payment. After you tap “Proceed to Payment” you’ll be sent to WhatsApp where we’ll share our Revolut tag and confirm the exact amount. Stock is reserved on submit and released if payment isn’t received within 24 hours.",
  },
  {
    id: "sleeks_wise",
    title: "Wise",
    kind: "manual",
    statusAfterOrder: "on-hold",
    instructions:
      "Your order will be created as Pending Payment. After you tap “Proceed to Payment” you’ll be sent to WhatsApp where we’ll share our Wise tag and confirm the exact amount. Stock is reserved on submit and released if payment isn’t received within 24 hours.",
  },
  { id: "atlas_idr_account", title: "IDR Account", kind: "manual", statusAfterOrder: "pending" },
  { id: "payram", title: "Pay with Crypto (PayRam)", kind: "online", statusAfterOrder: "pending" },
  { id: "bitbridge-pay-gateway-hosted", title: "Credit Card", kind: "online", statusAfterOrder: "pending" },
  {
    id: "cod",
    title: "COD in Bali",
    kind: "manual",
    statusAfterOrder: "processing",
    instructions:
      "Pay our courier in IDR when your order is dropped off. After submit, we’ll confirm availability on WhatsApp (some delivery zones and large orders may need pre-payment). Stock is reserved on submit and released if the order can’t be confirmed.",
    // Live says "above", but an order of exactly Rp 2,500,000 is allowed (the code checks "<").
    minimum: {
      amount: COD_MINIMUM,
      lockTitle: "🔒 Cash on Delivery unavailable",
      lockText: () => `Available for orders above Rp${thousands(COD_MINIMUM)}`,
      error: `Cash on Delivery is available only for orders above Rp${thousands(COD_MINIMUM)}. Please select another payment method.`,
    },
  },
];

/**
 * "Top up your supplies" under the cart table (the owner's snippet "add products at cart", §4): these
 * products, in this order, leaving out the ones already in the cart and those out of stock.
 */
export const cartTopUp = {
  title: "Top up your supplies",
  text: "Your vial includes 3ml bac water + 6 syringes + 6 alcohol pads. Need extra?",
  // Storage case, BAC water 10ml, BAC water 3ml, 0.5ml syringes, travel cooler, portable cooler, pen case.
  productIds: [6362, 884, 885, 4245, 10701, 10695, 4249],
};

/** Shown next to IDR amounts ("~$12.34"), fixed in the owner's snippet (Q-13). */
export const idrPerUsd = 16_500;

/** Unpaid orders keep their stock this long, then WooCommerce cancels them (Q-48: the IDR text says 24 h). */
export const holdStockMinutes = 60;

/**
 * Delivery slots at checkout (§4): today and the next 7 days, these time windows. "Today" is a date in
 * WordPress's time zone, which is set to UTC+0: from 00:00 to 08:00 Bali time live still offers
 * yesterday's date as "Today". Copied as it is until the owner decides (Q-50: Asia/Makassar recommended).
 */
export const deliverySlots = {
  days: 8,
  times: ["07:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00", "21:00-23:00"] as const,
  timeZone: "UTC",
};
