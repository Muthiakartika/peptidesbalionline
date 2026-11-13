/**
 * Orders (server code only): saving one when "Place order" is accepted, and reading one back for the
 * thank-you page and My Account. As the live site does it (WooCommerce + the owner's snippets, read in
 * wp-admin 7 Nov 2026):
 *   * the order keeps everything as it was at that moment: lines (name, options, price), the card fee line,
 *     shipping, the billing / shipping address, the delivery slot and address, the payment method;
 *   * the WhatsApp number is saved complete, "+62812…" (snippet 8811, internationalPhone below);
 *   * its status follows the payment method (store-settings.ts: Card, Revolut, Wise "On hold", IDR Account
 *     "Pending payment", COD "Processing");
 *   * no stock is reduced: no product on live tracks a quantity, stock is a status set by hand.
 * The number is the database's sequence (the WooCommerce import sets it past the highest live number).
 */
import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderFees, orderItems, orderNotes, orders } from "@/db/schema";

import type { CheckoutInput } from "./checkout-validation";
import type { PricedLine } from "./cart-lines";
import { sendOrderStatusEmails } from "@/lib/email/order-notifications";
import { syncOrderRewards } from "@/lib/loyalty/store";

import { recordOrderCoupons, updateCouponUsageForStatus, type StoredCoupon } from "./coupon-store";
import { paymentMethods, type PaymentMethodId } from "./store-settings";
import type { Totals } from "./totals";

/**
 * The owner's snippet "add country code at checkout": digits only, no leading 0, no repeated calling code,
 * then the calling code: ("ID|+62", "0812 3456") → "+628123456".
 */
export function internationalPhone(countryData: string, phone: string): string {
  const [, callingCode] = countryData.split("|");
  if (!callingCode) return phone;
  let digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return "";
  digits = digits.replace(/^0+/, "");
  const numericCode = callingCode.replace(/[^0-9]/g, "");
  if (numericCode && digits.startsWith(numericCode)) digits = digits.slice(numericCode.length);
  return callingCode + digits;
}

/** WooCommerce's order key: "wc_order_" + 13 random letters and digits. */
const newOrderKey = () => `wc_order_${randomBytes(10).toString("base64url").replace(/[-_]/g, "").slice(0, 13)}`;

export type PlacedOrder = { id: string; number: bigint; key: string };

export async function createOrder({
  input,
  lines,
  totals,
  coupons = [],
  userId,
  notes,
  deliveryLocation,
}: {
  input: CheckoutInput;
  lines: PricedLine[];
  totals: Totals;
  /** The coupons applied (already checked) and what each took off. */
  coupons?: { coupon: StoredCoupon; amount: bigint }[];
  userId: string | null;
  notes: string;
  deliveryLocation: { address: string; lat?: string; lng?: string };
}): Promise<PlacedOrder> {
  const method = paymentMethods.find((m) => m.id === input.paymentMethod);
  if (!method) throw new Error(`Unknown payment method ${input.paymentMethod}`);
  const b = input.billing;
  const billing = {
    firstName: b.fullName,
    lastName: "",
    phone: internationalPhone(b.phoneCountryCode, b.phone),
    phoneCountryCode: b.phoneCountryCode,
    email: b.email.trim().toLowerCase(),
    address1: b.address1,
    city: b.city,
    state: b.state,
    postcode: b.postcode.trim().toUpperCase(),
    country: b.country,
  };
  const s = input.shipping;
  const shipping = input.shipToDifferentAddress
    ? { firstName: s.firstName, lastName: s.lastName, phone: s.phone, address1: s.address1, city: s.city, state: s.state, postcode: s.postcode.trim().toUpperCase(), country: s.country }
    : { firstName: billing.firstName, lastName: "", phone: "", address1: billing.address1, city: billing.city, state: billing.state, postcode: billing.postcode, country: billing.country };
  const fee = totals.paymentAdjustment;
  const key = newOrderKey();

  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderKey: key,
        userId,
        status: method.statusAfterOrder,
        subtotalMinor: totals.subtotal,
        discountMinor: totals.discount,
        shippingMinor: totals.shipping?.cost ?? 0n,
        feesMinor: fee?.amount ?? 0n,
        totalMinor: totals.total,
        billingEmail: billing.email,
        billing,
        shipping,
        shippingMethod: totals.shipping?.rateId ?? null,
        shippingMethodTitle: totals.shipping?.title ?? null,
        paymentMethod: method.id,
        paymentMethodTitle: method.title,
        customerNote: notes || null,
        deliveryDay: input.deliveryDay,
        deliveryTimeSlot: input.deliveryTime,
        deliveryLocation,
      })
      .returning({ id: orders.id, number: orders.orderNumber });
    await tx.insert(orderItems).values(
      lines.map((line) => {
        const lineTotal = line.unitPrice * BigInt(line.quantity) - (totals.lineDiscounts.get(line.key) ?? 0n);
        return {
          orderId: order.id,
          legacyWcProductId: line.productId,
          legacyWcVariationId: line.variationId,
          productName: line.name,
          variantLabel: line.variantLabel,
          options: line.options,
          productPath: line.product.path,
          quantity: line.quantity,
          unitPriceMinor: line.unitPrice,
          lineSubtotalMinor: line.unitPrice * BigInt(line.quantity),
          lineDiscountMinor: totals.lineDiscounts.get(line.key) ?? 0n,
          lineTotalMinor: lineTotal,
        };
      }),
    );
    if (fee) await tx.insert(orderFees).values({ orderId: order.id, label: fee.label, amountMinor: fee.amount });
    // The coupons used, counted in their usage as WooCommerce does once an order is placed.
    await recordOrderCoupons(tx, { orderId: order.id, userId, email: billing.email, status: method.statusAfterOrder, coupons });
    return { id: order.id, number: order.number, key };
  });
}

/** Where the buyer goes after "Place order" (the payment method's own redirect on live). */
export function afterOrderAddress(method: PaymentMethodId, order: PlacedOrder): string {
  if (method === "atlas_idr_account") {
    // The owner's IDR Account gateway sends the buyer to WhatsApp with the order number.
    const message = `Hi, I've placed order #${order.number} using IDR Account.\n\nPlease send me the account number and confirm the exact amount.`;
    return `https://wa.me/6282326300167?text=${encodeURIComponent(message)}`;
  }
  return `/checkout/order-received/${order.number}/?key=${order.key}`;
}

export type OrderView = Awaited<ReturnType<typeof getOrderWithLines>>;

/** One order with its lines and fee lines, found by number and key (thank-you) or by number and owner. */
export async function getOrderWithLines(number: string, by: { key: string } | { userId: string }) {
  if (!/^\d{1,18}$/.test(number)) return null;
  const db = getDb();
  const match = "key" in by ? eq(orders.orderKey, by.key) : eq(orders.userId, by.userId);
  const [order] = await db.select().from(orders).where(and(eq(orders.orderNumber, BigInt(number)), match)).limit(1);
  if (!order) return null;
  const [items, fees] = await Promise.all([db.select().from(orderItems).where(eq(orderItems.orderId, order.id)), db.select().from(orderFees).where(eq(orderFees.orderId, order.id))]);
  return { order, items, fees };
}

/** WooCommerce's statuses that still need paying, and that the customer may cancel (pending, failed). */
export const NEEDS_PAYMENT = ["pending", "failed"] as const;
export const needsPayment = (status: string) => (NEEDS_PAYMENT as readonly string[]).includes(status);

/** WooCommerce's order status names (wc_get_order_status_name). */
export const ORDER_STATUS_NAMES: Record<string, string> = {
  "checkout-draft": "Draft",
  pending: "Pending payment",
  processing: "Processing",
  "on-hold": "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

/** The "Pay" link of an order (get_checkout_payment_url). */
export const paymentAddress = (number: bigint | string, key: string) => `/checkout/order-pay/${number}/?pay_for_order=true&key=${key}`;

/**
 * The "Cancel" link's token (WooCommerce's _wpnonce on the cancel URL): tied to the order and the
 * visitor's session, so a link from somewhere else can't cancel anyone's order.
 */
export function cancelToken(orderKey: string, sessionToken: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(`cancel-order|${orderKey}|${sessionToken}`).digest("hex").slice(0, 10);
}

/** The "Cancel" link (get_cancel_order_url): the cart address with WooCommerce's query, back to My Account. */
export const cancelAddress = (number: bigint | string, key: string, token: string) =>
  `/cart/?cancel_order=true&order=${key}&order_id=${number}&redirect=${encodeURIComponent("/my-account/")}&_wpnonce=${token}`;

/** A note on the order, as WooCommerce keeps them ("Order cancelled by customer."). */
export async function addOrderNote(orderId: string, body: string, isCustomerNote = false) {
  await getDb().insert(orderNotes).values({ orderId, body, isCustomerNote });
}

/**
 * Changes an order's status as $order->update_status() does (WC_Order::status_transition): nothing happens
 * when the status is already the same; the note reads "<note> Order status changed from Pending payment to
 * Cancelled."; the paid date is set the first time the order becomes processing or completed
 * (maybe_set_date_paid) and the completed date when it is completed; the coupons' usage follows
 * (wc_update_coupon_usage_counts: given back when cancelled or failed, counted again when it comes back).
 * Returns whether the status changed.
 */
export async function setOrderStatus(orderId: string, status: (typeof orders.$inferSelect)["status"], note = "", authorUserId?: string): Promise<boolean> {
  const previous = await changeOrderStatus(orderId, status, note, authorUserId);
  if (previous === null) return false;
  // After the change is saved, and never able to undo it (a problem there is logged): the rewards programme
  // follows the status (credits when completed, taken back when cancelled or refunded, src/lib/loyalty/store.ts),
  // then WooCommerce's e-mails for this change (src/lib/email/order-notifications.ts).
  await syncOrderRewards(orderId);
  await sendOrderStatusEmails(orderId, previous, status);
  return true;
}

/** Saves the new status; returns the one it had before, or null when nothing changed. */
async function changeOrderStatus(orderId: string, status: (typeof orders.$inferSelect)["status"], note: string, authorUserId?: string): Promise<string | null> {
  return getDb().transaction(async (db) => {
    const [current] = await db.select({ status: orders.status, paidAt: orders.paidAt }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!current || current.status === status) return null;
    const now = new Date();
    const paid = (status === "processing" || status === "completed") && !current.paidAt;
    await db
      .update(orders)
      .set({ status, updatedAt: now, ...(paid ? { paidAt: now } : {}), ...(status === "completed" ? { completedAt: now } : {}) })
      .where(eq(orders.id, orderId));
    const transition = `Order status changed from ${ORDER_STATUS_NAMES[current.status] ?? current.status} to ${ORDER_STATUS_NAMES[status] ?? status}.`;
    await db.insert(orderNotes).values({ orderId, authorUserId, body: [note, transition].filter(Boolean).join(" ") });
    await updateCouponUsageForStatus(db, orderId, status);
    return current.status;
  });
}
