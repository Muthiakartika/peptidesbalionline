/**
 * Sends WooCommerce's order e-mails (src/lib/email/order-emails.ts) after an order changes status:
 * setOrderStatus calls it once the change is saved, and placeOrder for a new order (from "pending" to the
 * payment method's status, as WooCommerce's checkout does it). It never throws and never undoes anything:
 * a problem sending is logged and the order stays as it is.
 *
 * The staff's e-mails go to ORDER_ALERT_TO (one or more addresses, comma-separated; default
 * hello@peptidesbali.online, live's setting), the customer's to the order's billing address. On a test site
 * sendEmail sends every one of them to EMAIL_TEST_TO instead (src/lib/email/index.ts).
 */
import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderFees, orderItems, orders } from "@/db/schema";
import { getProductById } from "@/lib/catalog";
import { parseAddress, sendEmail } from "@/lib/email";
import { mediaUrl } from "@/lib/media/url";
import { business, siteUrl } from "@/lib/site";

import { emailsForTransition, orderEmail, type OrderEmailExtras } from "./order-emails";

/**
 * The products' pictures for the e-mail (the square search thumbnail, else the main picture), as public
 * addresses. A product that no longer exists simply gets none; a catalogue problem never stops the e-mail.
 */
export async function orderEmailExtras(items: { id: string; legacyWcProductId: number | null }[]): Promise<OrderEmailExtras> {
  const images = new Map<string, string>();
  try {
    for (const item of items) {
      if (!item.legacyWcProductId) continue;
      const product = await getProductById(Number(item.legacyWcProductId));
      const src = mediaUrl(product?.searchImage?.src ?? product?.image?.src ?? "");
      if (src) images.set(item.id, src.startsWith("/") ? `${siteUrl}${src}` : src);
    }
  } catch (error) {
    console.warn("[order-emails] product pictures left out:", error instanceof Error ? error.message : error);
  }
  return { images };
}

/** Who gets the staff's order e-mails (new, cancelled, failed). */
export function staffRecipients(env: Record<string, string | undefined> = process.env): string[] {
  const listed = (env.ORDER_ALERT_TO ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => parseAddress(address));
  return listed.length ? listed : [business.email];
}

export async function sendOrderStatusEmails(orderId: string, from: string, to: string): Promise<void> {
  const kinds = emailsForTransition(from, to);
  if (!kinds.length) return;
  try {
    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;
    const [items, fees] = await Promise.all([db.select().from(orderItems).where(eq(orderItems.orderId, orderId)), db.select().from(orderFees).where(eq(orderFees.orderId, orderId))]);
    const view = { order, items, fees };
    const extras = await orderEmailExtras(items);
    for (const kind of kinds) {
      const email = orderEmail(kind, view, extras);
      const recipients = email.audience === "admin" ? staffRecipients() : [order.billingEmail].filter(Boolean);
      for (const recipient of recipients) {
        const result = await sendEmail({ to: recipient, subject: email.subject, text: email.text, html: email.html });
        if (result === "not-sent") console.warn(`[order-emails] "${email.subject}" wasn't sent (${email.audience} e-mail).`);
      }
    }
  } catch (error) {
    console.error(`[order-emails] the e-mails for order ${orderId} (${from} → ${to}) couldn't be sent:`, error);
  }
}
