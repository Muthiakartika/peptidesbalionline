/**
 * The "Customer note" e-mail WooCommerce sends when the shop adds a "Note to customer" to an order
 * (WC_Email_Customer_Note, plain-text template): the subject "Note added to your {site_title} order from
 * {order_date}", the heading, the note, and a short copy of the order (number, date, lines, totals) as
 * WC_Emails::order_details prints it in plain text. {site_title} = "Atlas Longevity".
 */
import "server-only";

import type { OrderView } from "@/lib/commerce/orders";
import { formatMoney } from "@/lib/money";
import { longDate } from "@/lib/blog/dates";

const SITE = "Atlas Longevity";
const RULE = "----------";

function orderSummary(view: NonNullable<OrderView>): string[] {
  const { order, items, fees } = view;
  const date = longDate(order.createdAt.toISOString().slice(0, 19));
  const lines = [`[Order #${order.orderNumber}] (${date})`, ""];
  for (const item of items) {
    lines.push(`${item.productName} × ${item.quantity} = ${formatMoney(item.lineTotalMinor)}`);
    for (const option of item.options ?? []) lines.push(`${option.label}: ${option.value}`);
    lines.push("");
  }
  lines.push("==========", "", `Subtotal: ${formatMoney(order.subtotalMinor)}`);
  if (order.discountMinor > 0n) lines.push(`Discount: -${formatMoney(order.discountMinor)}`);
  for (const fee of fees) lines.push(`${fee.label}: ${formatMoney(fee.amountMinor)}`);
  lines.push(`Shipping: ${order.shippingMinor > 0n ? formatMoney(order.shippingMinor) : (order.shippingMethodTitle ?? "")}`);
  lines.push(`Payment method: ${order.paymentMethodTitle}`, `Total: ${formatMoney(order.totalMinor)}`);
  return lines;
}

export function customerNoteEmail(view: NonNullable<OrderView>, note: string) {
  const { order } = view;
  const firstName = (order.billing as { firstName?: string }).firstName ?? "";
  return {
    subject: `Note added to your ${SITE} order from ${longDate(order.createdAt.toISOString().slice(0, 19))}`,
    text: [
      "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=",
      "A note has been added to your order",
      "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=",
      "",
      `Hi ${firstName},`,
      "",
      "The following note has been added to your order:",
      "",
      RULE,
      "",
      note,
      "",
      RULE,
      "",
      "As a reminder, here are your order details:",
      "",
      ...orderSummary(view),
      "",
      "----------------------------------------",
      "",
      "Thanks for reading.",
    ].join("\n"),
  };
}
