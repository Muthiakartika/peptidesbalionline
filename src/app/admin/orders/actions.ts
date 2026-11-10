"use server";

/**
 * The order screen's forms (staff only): change the status (noted "Order status changed from Pending
 * payment to Processing." as WooCommerce notes it, by src/lib/commerce/orders.ts) and add a note, private
 * or "Note to customer". Every action checks the staff role again: a form can be posted from anywhere.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderNotes, orders } from "@/db/schema";
import { getAccountUser, isStaff } from "@/lib/account/session";
import { getOrderWithLines, ORDER_STATUS_NAMES, setOrderStatus } from "@/lib/commerce/orders";
import { sendEmail } from "@/lib/email";
import { customerNoteEmail } from "@/lib/email/order-emails";

type Status = (typeof orders.$inferSelect)["status"];

async function staffUser() {
  const user = await getAccountUser().catch(() => null);
  if (!user || !isStaff(user)) throw new Error("Sorry, you are not allowed to do that.");
  return user;
}

async function refresh(orderId: string) {
  const [order] = await getDb().select({ number: orders.orderNumber }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order) revalidatePath(`/admin/orders/${order.number}/`);
}

export async function updateOrderStatus(orderId: string, form: FormData): Promise<void> {
  const user = await staffUser();
  const status = String(form.get("order_status") ?? "");
  if (!Object.hasOwn(ORDER_STATUS_NAMES, status)) return;
  if (await setOrderStatus(orderId, status as Status, "", user.id)) await refresh(orderId);
}

export async function addOrderNoteAction(orderId: string, form: FormData): Promise<void> {
  const user = await staffUser();
  const body = String(form.get("order_note") ?? "").trim().slice(0, 5000);
  if (!body) return;
  const isCustomerNote = form.get("order_note_type") === "customer";
  await getDb().insert(orderNotes).values({ orderId, authorUserId: user.id, body, isCustomerNote });
  if (isCustomerNote) await emailCustomerNote(orderId, body);
  await refresh(orderId);
}

/** WooCommerce e-mails the buyer a "Note to customer" (the Customer note e-mail, to the billing address). */
async function emailCustomerNote(orderId: string, note: string) {
  const [row] = await getDb().select({ number: orders.orderNumber, key: orders.orderKey }).from(orders).where(eq(orders.id, orderId)).limit(1);
  const view = row ? await getOrderWithLines(row.number.toString(), { key: row.key }) : null;
  const to = (view?.order.billing as { email?: string } | undefined)?.email;
  if (!view || !to) return;
  const result = await sendEmail({ to, ...customerNoteEmail(view, note) });
  if (result === "not-sent") console.warn("[order-note] the customer note e-mail wasn't sent: no e-mail provider is set up (Q-08).");
}
