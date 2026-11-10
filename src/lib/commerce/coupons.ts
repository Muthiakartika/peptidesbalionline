/**
 * Coupons, worked out the way WooCommerce 11 does on the live shop (WC_Discounts / WC_Cart::apply_coupon;
 * settings in docs/audit/backend-settings.md §1 and §7):
 *   * coupons are not applied one after another ("calc discounts sequentially: no"): each is counted on
 *     the original prices, and a line never gets more discount than it costs;
 *   * a percentage is rounded for the whole cart (half up) and spread over the items one cent at a time,
 *     most expensive item first;
 *   * a new individual-use coupon removes the others; another coupon can't join one.
 * Amounts are minor units (src/lib/money.ts). The error texts are WooCommerce 11.2.1's English texts
 * (WC_Coupon::get_coupon_error, WC_Discounts::is_coupon_valid), in the order WooCommerce checks them.
 */
import { formatMoney } from "@/lib/money";

export type CouponType = "percent" | "fixed_cart" | "fixed_product";

export type Coupon = {
  /** Stored lower case; WooCommerce matches codes case-insensitively. */
  code: string;
  type: CouponType;
  /** As WooCommerce stores it: "10.00" (percent) or "250000.00" (rupiah). */
  amount: string;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  usageLimitPerUser: number | null;
  individualUse: boolean;
  freeShipping: boolean;
  minimumAmount: bigint | null;
  maximumAmount: bigint | null;
  excludeSaleItems: boolean;
  productIds: number[];
  excludedProductIds: number[];
  categorySlugs: string[];
  excludedCategorySlugs: string[];
  emailRestrictions: string[];
  limitUsageToXItems: number | null;
};

export type CartLine = {
  key: string;
  productId: number;
  variationId: number | null;
  /** Product name, used in WooCommerce's "not applicable to the products: …" message. */
  name: string;
  /** The product's category slugs AND their parent categories (WooCommerce counts the parents too). */
  categories: string[];
  onSale: boolean;
  unitPrice: bigint;
  quantity: number;
};

export type ApplyResult = { ok: true; applied: Coupon[] } | { ok: false; error: string };

/**
 * A coupon as the checkout page's script gets it (it works the totals out again when the payment method
 * changes). Only the rules: never who used it (used_by holds other customers' e-mails).
 */
export type CouponData = Omit<Coupon, "expiresAt" | "minimumAmount" | "maximumAmount"> & { expiresAt: string | null; minimumAmount: string | null; maximumAmount: string | null };

export const couponToData = (c: Coupon): CouponData => ({
  code: c.code,
  type: c.type,
  amount: c.amount,
  expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
  usageLimit: c.usageLimit,
  usageCount: c.usageCount,
  usageLimitPerUser: c.usageLimitPerUser,
  individualUse: c.individualUse,
  freeShipping: c.freeShipping,
  minimumAmount: c.minimumAmount === null ? null : c.minimumAmount.toString(),
  maximumAmount: c.maximumAmount === null ? null : c.maximumAmount.toString(),
  excludeSaleItems: c.excludeSaleItems,
  productIds: c.productIds,
  excludedProductIds: c.excludedProductIds,
  categorySlugs: c.categorySlugs,
  excludedCategorySlugs: c.excludedCategorySlugs,
  emailRestrictions: [],
  limitUsageToXItems: c.limitUsageToXItems,
});

export const couponFromData = (d: CouponData): Coupon => ({
  ...d,
  expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
  minimumAmount: d.minimumAmount === null ? null : BigInt(d.minimumAmount),
  maximumAmount: d.maximumAmount === null ? null : BigInt(d.maximumAmount),
});

/** WordPress's sanitize_title (sanitize_title_with_dashes) for the row class "coupon-<code>". */
export function sanitizeTitle(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/&.+?;/g, "")
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "10.00" → 1000 (hundredths), "250000.00" → 25000000. */
function hundredths(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2})\d*)?$/.exec(amount.trim());
  if (!match) throw new RangeError(`Not a coupon amount: "${amount}"`);
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "0").padEnd(2, "0"));
}

/** a / b rounded half up (both ≥ 0), as PHP's round() for positive numbers. */
function roundDiv(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (b * 2n);
}

const lineTotal = (line: CartLine) => line.unitPrice * BigInt(line.quantity);
const lineIds = (line: CartLine) => [line.productId, line.variationId].filter((id): id is number => id !== null);
const isCartCoupon = (coupon: Coupon) => coupon.type === "fixed_cart";

/** WC_Coupon::is_valid_for_product: whether a line gets this (percent / fixed product) coupon's discount. */
export function isLineEligible(coupon: Coupon, line: CartLine): boolean {
  const ids = lineIds(line);
  const limited = coupon.productIds.length > 0 || coupon.categorySlugs.length > 0;
  let valid =
    !limited ||
    ids.some((id) => coupon.productIds.includes(id)) ||
    line.categories.some((slug) => coupon.categorySlugs.includes(slug));
  if (ids.some((id) => coupon.excludedProductIds.includes(id))) valid = false;
  if (line.categories.some((slug) => coupon.excludedCategorySlugs.includes(slug))) valid = false;
  if (coupon.excludeSaleItems && line.onSale) valid = false;
  return valid;
}

export type ValidateOptions = {
  now?: Date;
  categoryName?: (slug: string) => string;
  /** How often the logged-in customer used it (WooCommerce checks guests by billing e-mail at checkout). */
  timesUsedByUser?: number;
  /** The e-mails WooCommerce compares with the coupon's "Allowed emails"; null skips that check. */
  emails?: string[] | null;
};

/** The texts WooCommerce shows when a coupon is dropped from the cart, or doesn't fit the customer. */
export const couponMessages = {
  invalidRemoved: (code: string) => `Sorry, it seems the coupon "${code}" is invalid - it has now been removed from your order.`,
  usageLimit: (code: string) => `Usage limit for coupon "${code}" has been reached.`,
  /** At checkout (a billing e-mail was sent) and before it (in the cart). */
  notYours: (code: string, atCheckout: boolean) => (atCheckout ? `Please enter a valid email to use coupon code "${code}".` : `Please enter a valid email at checkout to use coupon code "${code}".`),
  applied: "Coupon code applied successfully.",
  removed: "Coupon has been removed.",
};

const escapeRegex = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

/** WooCommerce's "Allowed emails" (DiscountsUtil::is_coupon_emails_allowed): exact, or with * wildcards. */
export function emailsAllowed(emails: string[], restrictions: string[]): boolean {
  return emails.some((email) => {
    const address = email.trim().toLowerCase();
    return restrictions.some((pattern) => new RegExp(`^${escapeRegex(pattern.toLowerCase()).replace(/\*/g, ".*")}$`).test(address));
  });
}

/** WC_Discounts::is_coupon_valid: the first problem with this coupon for these cart lines, or null. */
export function validateCoupon(coupon: Coupon, lines: CartLine[], { now = new Date(), categoryName = (slug) => slug, timesUsedByUser = 0, emails = null }: ValidateOptions = {}): string | null {
  const code = coupon.code;
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return couponMessages.usageLimit(code);
  if (coupon.usageLimitPerUser !== null && coupon.usageLimitPerUser > 0 && timesUsedByUser >= coupon.usageLimitPerUser) return couponMessages.usageLimit(code);
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) return `Coupon "${code}" has expired.`;
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0n);
  if (coupon.minimumAmount && coupon.minimumAmount > 0n && subtotal < coupon.minimumAmount) {
    return `The minimum spend for coupon "${code}" is ${formatMoney(coupon.minimumAmount)}.`;
  }
  if (coupon.maximumAmount && coupon.maximumAmount > 0n && subtotal > coupon.maximumAmount) {
    return `The maximum spend for coupon "${code}" is ${formatMoney(coupon.maximumAmount)}.`;
  }
  const notApplicable = `Sorry, coupon "${code}" is not applicable to selected products.`;
  if (coupon.productIds.length && !lines.some((line) => lineIds(line).some((id) => coupon.productIds.includes(id)))) return notApplicable;
  if (
    coupon.categorySlugs.length &&
    !lines.some((line) => !(coupon.excludeSaleItems && line.onSale) && line.categories.some((slug) => coupon.categorySlugs.includes(slug)))
  ) {
    return notApplicable;
  }
  if (isCartCoupon(coupon)) {
    if (coupon.excludeSaleItems && lines.some((line) => line.onSale)) return `Sorry, coupon "${code}" is not valid for sale items.`;
    const excludedProducts = lines.filter((line) => lineIds(line).some((id) => coupon.excludedProductIds.includes(id)));
    if (excludedProducts.length) {
      return `Sorry, coupon "${code}" is not applicable to the products: ${[...new Set(excludedProducts.map((line) => line.name))].join(", ")}.`;
    }
    const excludedCategories = [...new Set(lines.flatMap((line) => line.categories.filter((slug) => coupon.excludedCategorySlugs.includes(slug))))];
    if (excludedCategories.length) return `Sorry, coupon "${code}" is not applicable to the categories: ${excludedCategories.map(categoryName).join(", ")}.`;
  } else if (!lines.some((line) => isLineEligible(coupon, line))) {
    return notApplicable;
  }
  if (emails !== null && coupon.emailRestrictions.length && !emailsAllowed(emails.filter(Boolean), coupon.emailRestrictions)) return couponMessages.notYours(code, false);
  return null;
}

/**
 * "Apply coupon" in the cart or the checkout's coupon box. `coupon` is the coupon found for `code`
 * (undefined when there is none); `applied` the coupons already in the cart, in order.
 */
export function applyCoupon(coupon: Coupon | undefined, code: string, lines: CartLine[], applied: Coupon[], options: ValidateOptions = {}): ApplyResult {
  if (!coupon) return { ok: false, error: `Coupon "${code.trim().toLowerCase()}" cannot be applied because it does not exist.` };
  const error = validateCoupon(coupon, lines, options);
  if (error) return { ok: false, error };
  if (applied.some((c) => c.code === coupon.code)) return { ok: false, error: `Coupon code "${coupon.code}" already applied!` };
  const kept = coupon.individualUse ? [] : applied;
  const individual = kept.find((c) => c.individualUse);
  if (individual) {
    return { ok: false, error: `Sorry, coupon "${individual.code}" has already been applied and cannot be used in conjunction with other coupons.` };
  }
  return { ok: true, applied: [...kept, coupon] };
}

/**
 * At "Place order" (WC_Cart::check_customer_coupons): the coupon's "Allowed emails" against the billing
 * e-mail and the account's (failing removes the coupon), then, for a guest, the per-customer limit counted
 * by billing e-mail (logged-in customers were checked by account already).
 */
export function checkCouponForCustomer(
  coupon: Coupon,
  { emails, guest, timesUsedByEmail }: { emails: string[]; guest: boolean; timesUsedByEmail: number },
): { ok: true } | { ok: false; error: string; remove: boolean } {
  if (coupon.emailRestrictions.length && !emailsAllowed(emails.filter(Boolean), coupon.emailRestrictions)) {
    return { ok: false, error: couponMessages.notYours(coupon.code, true), remove: true };
  }
  if (guest && coupon.usageLimitPerUser !== null && coupon.usageLimitPerUser > 0 && timesUsedByEmail >= coupon.usageLimitPerUser) {
    return { ok: false, error: couponMessages.usageLimit(coupon.code), remove: false };
  }
  return { ok: true };
}

/**
 * Discount per line for each applied coupon (coupon code → line key → amount), in the order the
 * coupons were applied.
 */
export function couponDiscounts(coupons: Coupon[], lines: CartLine[]): Map<string, Map<string, bigint>> {
  const remaining = new Map(lines.map((line) => [line.key, lineTotal(line)]));
  // WooCommerce works through the items from the highest unit price to the lowest.
  const ordered = [...lines].sort((a, b) => (a.unitPrice === b.unitPrice ? 0 : a.unitPrice < b.unitPrice ? 1 : -1));
  const result = new Map<string, Map<string, bigint>>();

  for (const coupon of coupons) {
    const perLine = new Map<string, bigint>();
    const give = (key: string, amount: bigint) => {
      const left = remaining.get(key) ?? 0n;
      const given = amount > left ? left : amount;
      remaining.set(key, left - given);
      perLine.set(key, (perLine.get(key) ?? 0n) + given);
      return given;
    };
    // Which units the coupon covers ("limit usage to X items": units, most expensive first).
    let unitsLeft = coupon.limitUsageToXItems ?? Number.POSITIVE_INFINITY;
    const targets = ordered
      .filter((line) => line.unitPrice > 0n && (isCartCoupon(coupon) || isLineEligible(coupon, line)))
      .map((line) => {
        const quantity = Math.min(line.quantity, unitsLeft);
        unitsLeft -= quantity;
        return { line, quantity: BigInt(quantity), price: line.unitPrice * BigInt(quantity) };
      })
      .filter((target) => target.quantity > 0n);
    const amount = hundredths(coupon.amount);

    if (coupon.type === "percent") {
      let total = 0n;
      for (const target of targets) total += give(target.line.key, (target.price * amount) / 10_000n);
      const wanted = roundDiv(targets.reduce((sum, t) => sum + t.price, 0n) * amount, 10_000n);
      if (wanted > total) spreadRemainder(targets, wanted - total, give);
    } else if (coupon.type === "fixed_product") {
      // The amount (hundredths of a rupiah = minor units) off each unit, at most the unit's price.
      for (const target of targets) give(target.line.key, (amount < target.line.unitPrice ? amount : target.line.unitPrice) * target.quantity);
    } else {
      // fixed_cart: the amount spread evenly over the units, at most what they cost.
      let left = amount;
      while (left > 0n) {
        const units = targets.reduce((sum, t) => sum + t.quantity, 0n);
        const perUnit = units > 0n ? left / units : 0n;
        let given = 0n;
        if (perUnit > 0n) for (const target of targets) given += give(target.line.key, perUnit * target.quantity);
        else given = spreadRemainder(targets, left, give);
        if (given === 0n) break;
        left -= given;
      }
    }
    result.set(coupon.code, perLine);
  }
  return result;
}

/** One minor unit per item unit, most expensive first, until `amount` is given (WooCommerce's remainder). */
function spreadRemainder(targets: { line: CartLine; quantity: bigint }[], amount: bigint, give: (key: string, amount: bigint) => bigint): bigint {
  let given = 0n;
  for (const target of targets) {
    for (let unit = 0n; unit < target.quantity && given < amount; unit++) given += give(target.line.key, 1n);
    if (given >= amount) break;
  }
  return given;
}
