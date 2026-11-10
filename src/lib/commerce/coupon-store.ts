/**
 * Coupons from the database (imported from WooCommerce: scripts/import/import-wordpress.mjs), with
 * WooCommerce's bookkeeping around them:
 *   * findCoupons: the published coupons for some codes (a coupon that isn't published "does not exist",
 *     as wc_get_coupon_id_by_code only finds published ones);
 *   * checkCartCoupons: WC_Cart::check_cart_coupons, the cart's coupons that are still valid, and a
 *     notice for each one that isn't ("Sorry, it seems the coupon … is invalid - it has now been removed…");
 *   * usage (wc_update_coupon_usage_counts): an order's coupons are counted once it is placed (usage_count
 *     + 1 and its customer in used_by: the WordPress user ID, or the billing e-mail for a guest) and given
 *     back when it is cancelled or failed; orders.coupon_usage_recorded stops counting twice.
 */
import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { addresses, couponRedemptions, coupons, orders, users } from "@/db/schema";
import { getCategories } from "@/lib/catalog";

import { couponMessages, validateCoupon, type CartLine, type Coupon } from "./coupons";

export type StoredCoupon = Coupon & { id: string; usedBy: string[] };
type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const rowToCoupon = (row: typeof coupons.$inferSelect): StoredCoupon => ({
  id: row.id,
  code: row.code.toLowerCase(),
  type: row.type,
  amount: row.amount,
  expiresAt: row.expiresAt,
  usageLimit: row.usageLimit,
  usageCount: row.usageCount,
  usageLimitPerUser: row.usageLimitPerUser,
  individualUse: row.individualUse,
  freeShipping: row.freeShipping,
  minimumAmount: row.minimumAmountMinor,
  maximumAmount: row.maximumAmountMinor,
  excludeSaleItems: row.excludeSaleItems,
  productIds: row.productIds,
  excludedProductIds: row.excludedProductIds,
  categorySlugs: row.categorySlugs,
  excludedCategorySlugs: row.excludedCategorySlugs,
  emailRestrictions: row.emailRestrictions,
  limitUsageToXItems: row.limitUsageToXItems,
  usedBy: row.usedBy,
});

/** wc_format_coupon_code: trimmed and lower case (WooCommerce's `woocommerce_coupon_code` filter). */
export const formatCouponCode = (code: string) => code.trim().toLowerCase();

/** Names categories in WooCommerce's "not applicable to the categories: …" message (current names). */
export async function categoryNamer(): Promise<(slug: string) => string> {
  const names = new Map((await getCategories()).map((category) => [category.slug, category.name]));
  return (slug) => names.get(slug) ?? slug;
}

export async function findCoupons(codes: string[]): Promise<Map<string, StoredCoupon>> {
  const wanted = [...new Set(codes.map(formatCouponCode).filter(Boolean))];
  if (!wanted.length) return new Map();
  const rows = await getDb()
    .select()
    .from(coupons)
    .where(and(eq(coupons.enabled, true), inArray(sql`lower(${coupons.code})`, wanted)));
  return new Map(rows.map((row) => [row.code.toLowerCase(), rowToCoupon(row)]));
}

/** A customer as WooCommerce's coupon checks see them: account keys in used_by, and the e-mails it compares. */
export type CouponCustomer = { userId: string | null; keys: string[]; emails: string[] };

/**
 * The used_by keys of an account: the ID here and, for an account imported from WordPress, its WordPress
 * user ID (imported coupons list those). A guest has none (WooCommerce counts guests by billing e-mail).
 */
export async function couponCustomer(user: { id: string; email: string } | null, billingEmail = ""): Promise<CouponCustomer> {
  if (!user) return { userId: null, keys: [], emails: [billingEmail].filter(Boolean).map(formatCouponCode) };
  const [row] = await getDb().select({ legacy: users.legacyWpUserId }).from(users).where(eq(users.id, user.id)).limit(1);
  // WooCommerce compares the account's e-mail and the customer's billing e-mail (the saved one until checkout sends one).
  const [saved] = billingEmail ? [] : await getDb().select({ email: addresses.email }).from(addresses).where(and(eq(addresses.userId, user.id), eq(addresses.type, "billing"))).limit(1);
  return {
    userId: user.id,
    keys: [user.id, ...(row?.legacy ? [String(row.legacy)] : [])],
    emails: [...new Set([user.email, billingEmail || saved?.email || ""].filter(Boolean).map(formatCouponCode))],
  };
}

/** How often this customer used the coupon, by account keys or e-mail (WooCommerce's _used_by entries). */
export function timesUsedBy(coupon: StoredCoupon, keysOrEmails: string[]): number {
  const wanted = new Set(keysOrEmails.filter(Boolean).map((key) => key.toLowerCase()));
  return coupon.usedBy.filter((entry) => wanted.has(entry.toLowerCase())).length;
}

/** The coupon's used_by key for an order: the account's WordPress ID (or ID here), or the billing e-mail. */
export async function usedByKey(db: Executor, userId: string | null, billingEmail: string): Promise<string> {
  if (!userId) return formatCouponCode(billingEmail);
  const [row] = await db.select({ legacy: users.legacyWpUserId }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.legacy ? String(row.legacy) : userId;
}

export type CartCouponCheck = { coupons: StoredCoupon[]; removedCodes: string[]; notices: string[] };

/**
 * WC_Cart::check_cart_coupons on the cart's codes (in the order they were applied): a coupon that no longer
 * exists or isn't valid for these lines any more is dropped with WooCommerce's notice. No database query
 * when the cart has no coupons.
 */
export async function checkCartCoupons(codes: string[], lines: CartLine[], customer: CouponCustomer): Promise<CartCouponCheck> {
  if (!codes.length) return { coupons: [], removedCodes: [], notices: [] };
  const found = await findCoupons(codes);
  const categoryName = await categoryNamer();
  const valid: StoredCoupon[] = [];
  const removedCodes: string[] = [];
  for (const code of codes) {
    const coupon = found.get(formatCouponCode(code));
    const error = coupon
      ? validateCoupon(coupon, lines, { categoryName, timesUsedByUser: customer.userId ? timesUsedBy(coupon, customer.keys) : 0, emails: customer.emails })
      : "gone";
    if (coupon && !error) valid.push(coupon);
    else removedCodes.push(formatCouponCode(code));
  }
  return { coupons: valid, removedCodes, notices: removedCodes.map(couponMessages.invalidRemoved) };
}

/** Counts (or gives back) the coupons used on an order, once: wc_update_coupon_usage_counts. */
async function changeUsage(db: Executor, orderId: string, action: "increase" | "reduce") {
  const [order] = await db.select({ userId: orders.userId, email: orders.billingEmail }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const codes = (await db.select({ code: couponRedemptions.code }).from(couponRedemptions).where(eq(couponRedemptions.orderId, orderId))).map((r) => r.code);
  await db.update(orders).set({ couponUsageRecorded: action === "increase" }).where(eq(orders.id, orderId));
  if (!codes.length) return;
  const key = await usedByKey(db, order.userId, order.email);
  const matching = inArray(sql`lower(${coupons.code})`, codes.map(formatCouponCode));
  if (action === "increase") {
    await db
      .update(coupons)
      .set({ usageCount: sql`${coupons.usageCount} + 1`, usedBy: sql`array_append(${coupons.usedBy}, ${key})`, updatedAt: new Date() })
      .where(matching);
  } else {
    // decrease_usage_count: one less, and one used_by entry of this customer removed (not all of them).
    const position = sql`array_position(${coupons.usedBy}, ${key})`;
    await db
      .update(coupons)
      .set({
        usageCount: sql`greatest(${coupons.usageCount} - 1, 0)`,
        usedBy: sql`CASE WHEN ${position} IS NULL THEN ${coupons.usedBy} ELSE ${coupons.usedBy}[:${position} - 1] || ${coupons.usedBy}[${position} + 1:] END`,
        updatedAt: new Date(),
      })
      .where(matching);
  }
}

/** After an order's status changed: cancelled / failed give the coupons back, any other status counts them. */
export async function updateCouponUsageForStatus(db: Executor, orderId: string, status: string) {
  if (status === "checkout-draft") return;
  const [order] = await db.select({ recorded: orders.couponUsageRecorded }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const invalid = status === "cancelled" || status === "failed";
  if (invalid && order.recorded) await changeUsage(db, orderId, "reduce");
  else if (!invalid && !order.recorded) await changeUsage(db, orderId, "increase");
}

/** The coupons of a new order: one redemption row each (with its discount), then counted. */
export async function recordOrderCoupons(db: Executor, input: { orderId: string; userId: string | null; email: string; status: string; coupons: { coupon: StoredCoupon; amount: bigint }[] }) {
  if (input.coupons.length) {
    await db.insert(couponRedemptions).values(
      input.coupons.map(({ coupon, amount }) => ({ couponId: coupon.id, code: coupon.code, orderId: input.orderId, userId: input.userId, email: formatCouponCode(input.email), amountMinor: amount })),
    );
  }
  await updateCouponUsageForStatus(db, input.orderId, input.status);
}
