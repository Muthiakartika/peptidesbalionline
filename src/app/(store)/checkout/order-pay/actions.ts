"use server";

/**
 * "Pay for order" on /checkout/order-pay/<n>/ (WooCommerce's pay_action): the order's key and owner are
 * checked again, then the terms and the payment method; the method is saved on the order and handled as
 * at checkout (src/lib/commerce/orders.ts: IDR Account goes to WhatsApp, the others to the thank-you
 * page). Only orders that still need paying (pending, failed) can be paid.
 */
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { notice, type Notice } from "@/lib/account/notices";
import { getAccountUser } from "@/lib/account/session";
import { afterOrderAddress, getOrderWithLines, needsPayment, ORDER_STATUS_NAMES, setOrderStatus } from "@/lib/commerce/orders";
import { paymentMethods } from "@/lib/commerce/store-settings";

export type PayResult = { notices: Notice[]; redirect?: string };

export async function payForOrder(number: string, key: string, methodId: string, terms: boolean): Promise<PayResult> {
  const view = typeof key === "string" && key.startsWith("wc_order_") ? await getOrderWithLines(String(number).slice(0, 20), { key }).catch(() => null) : null;
  if (!view) return { notices: [notice.error("Sorry, this order is invalid and cannot be paid for.")] };
  const { order } = view;
  if (order.userId) {
    const user = await getAccountUser().catch(() => null);
    if (user?.id !== order.userId) return { notices: [notice.error("This order cannot be paid for. Please contact us if you need assistance.")] };
  }
  if (!needsPayment(order.status)) {
    return { notices: [notice.error(`This order’s status is “${ORDER_STATUS_NAMES[order.status] ?? order.status}”—it cannot be paid for. Please contact us if you need assistance.`)] };
  }
  if (!terms) return { notices: [notice.error("Please read and accept the terms and conditions to proceed with your order.")] };
  const method = paymentMethods.find((m) => m.id === methodId);
  if (!method) return { notices: [notice.error("Invalid payment method.")] };
  if (method.kind === "online") {
    return { notices: [notice.error(`${method.title} can't be used on this copy of the shop yet: the payment provider isn't connected. Please choose another payment method.`)] };
  }
  // The card / COD minimums count the order's products after coupons, as at checkout.
  const cartAmount = order.subtotalMinor - order.discountMinor;
  if (method.minimum && cartAmount < method.minimum.amount) return { notices: [notice.error(method.minimum.error)] };

  try {
    await getDb().update(orders).set({ paymentMethod: method.id, paymentMethodTitle: method.title, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await setOrderStatus(order.id, method.statusAfterOrder);
  } catch (error) {
    console.error("[order-pay] database error", error);
    return { notices: [notice.error("Your payment couldn't be saved: the shop's database can't be reached right now. Please try again in a moment.")] };
  }
  return { notices: [], redirect: afterOrderAddress(method.id, { id: order.id, number: order.orderNumber, key: order.orderKey }) };
}
