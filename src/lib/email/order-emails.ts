/**
 * WooCommerce's order e-mails, as the live shop has them set (wp_options read from the 12 Nov 2026 dump):
 * WooCommerce 11.2.1 with its "email improvements" on and the block e-mail editor off, {site_title} =
 * "Atlas Longevity", sender "Peptides Bali" <hello@peptidesbali.online>, the admin e-mails (new / cancelled /
 * failed order) to hello@peptidesbali.online with their saved closing texts, every customer e-mail with
 * WooCommerce's defaults (none of them has saved settings).
 *
 * Texts from WooCommerce 11.2.1's own source (templates/emails/plain/*.php, includes/emails/class-wc-email-*.php):
 * the plain-text version, as WooCommerce sends it (WC_Email::get_content_plain: tags stripped, runs of spaces
 * made one), and a designed HTML version with the same texts in the shop's look (redesigned on purpose on
 * 13 Nov 2026: live's are WooCommerce's black-and-white template): progress bar, how to pay, product pictures,
 * delivery box, a button to the order. The owner's own "Atlas Email Automations" flows (welcome, abandoned
 * cart, product guides, after the purchase) aren't rebuilt: their source is needed (Q-15).
 *
 * Which status change sends which e-mail: emailsForTransition (the classes' hooks).
 */
import "server-only";

import type { OrderView } from "@/lib/commerce/orders";
import { formatAddress } from "@/lib/account/validation";
import { deliveryDayLabel, deliveryTimeLabel } from "@/lib/commerce/delivery";
import { paymentMethods } from "@/lib/commerce/store-settings";
import { formatMoney } from "@/lib/money";
import { longDate } from "@/lib/blog/dates";
import { business, siteUrl } from "@/lib/site";

import {
  addressBlock,
  button,
  COLOR,
  esc,
  FONT,
  helpBlock,
  href,
  infoBox,
  layout,
  noteBox,
  paragraph,
  paragraphHtml,
  sectionTitle,
  tracker,
  twoColumns,
  whatsappLink,
} from "./html";

const SITE = business.name;
/** WooCommerce's {store_email}: the sender's address. */
const STORE_EMAIL = business.email;
const BANNER = "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=";
const RULE = "----------------------------------------";
/** The footer text setting "{site_title}<br />{store_address}" with the tags stripped (no store address is set). */
const FOOTER = SITE;
const THANKS = `Thanks again! If you need any help with your order, please contact us at ${STORE_EMAIL}.`;
const REMINDER = "Here’s a reminder of what you’ve ordered:";

type View = NonNullable<OrderView>;
type Address = { firstName?: string; lastName?: string; address1?: string; city?: string; state?: string; postcode?: string; country?: string; phone?: string; email?: string };

export type OrderEmailKind =
  | "new_order"
  | "cancelled_order"
  | "failed_order"
  | "customer_on_hold_order"
  | "customer_processing_order"
  | "customer_completed_order"
  | "customer_refunded_order";

export type OrderEmail = { kind: OrderEmailKind; audience: "admin" | "customer"; subject: string; text: string; html: string };

const among = (list: string[]) => (status: string) => list.includes(status);
const fromOpen = among(["pending", "failed", "cancelled"]);

/** Each e-mail's woocommerce_order_status_<from>_to_<to>_notification hooks (WooCommerce 11.2.1). */
const TRIGGERS: Record<OrderEmailKind, (from: string, to: string) => boolean> = {
  new_order: (from, to) => fromOpen(from) && among(["processing", "completed", "on-hold"])(to),
  customer_on_hold_order: (from, to) => fromOpen(from) && to === "on-hold",
  customer_processing_order: (from, to) => among(["pending", "failed", "on-hold", "cancelled"])(from) && to === "processing",
  customer_completed_order: (_from, to) => to === "completed",
  cancelled_order: (from, to) => among(["pending", "processing", "on-hold"])(from) && to === "cancelled",
  failed_order: (from, to) => among(["pending", "on-hold"])(from) && to === "failed",
  // Setting "Refunded" refunds what is left (wc_order_fully_refunded), which sends the "fully refunded" e-mail.
  customer_refunded_order: (_from, to) => to === "refunded",
};

/** The e-mails WooCommerce sends when an order goes from one status to another (a placed order starts at "pending"). */
export function emailsForTransition(from: string, to: string): OrderEmailKind[] {
  if (from === to) return [];
  return (Object.keys(TRIGGERS) as OrderEmailKind[]).filter((kind) => TRIGGERS[kind](from, to));
}

const billingOf = (view: View) => view.order.billing as Address;
const firstName = (view: View) => billingOf(view).firstName ?? "";
/** get_formatted_billing_full_name: first and last name. */
const fullName = (view: View) => [billingOf(view).firstName, billingOf(view).lastName].filter(Boolean).join(" ");
const orderDate = (view: View) => longDate(view.order.createdAt.toISOString().slice(0, 19));
const addressLines = (a: Address | null) =>
  a ? formatAddress({ first_name: a.firstName ?? "", last_name: a.lastName ?? "", address_1: a.address1 ?? "", city: a.city ?? "", state: a.state ?? "", postcode: a.postcode ?? "", country: a.country ?? "" }) : [];

/** emails/plain/email-order-details.php + email-order-items.php (email improvements on; WooCommerce's padding collapses to one space). */
export function orderDetails(view: View, sentToAdmin: boolean): string {
  const { order, items, fees } = view;
  let out = `Order #${order.orderNumber} (${orderDate(view)})\n\n==========\n\n`;
  for (const item of items) {
    out += `${item.productName} × ${item.quantity} ${formatMoney(item.lineSubtotalMinor)}\n`;
    if (item.options?.length) out += item.options.map((option) => `\n- ${option.label}: ${option.value}`).join("");
    out += "\n\n";
  }
  out += "==========\n\n";
  // get_order_item_totals, as the order page shows them (src/components/woocommerce/order/OrderDetails.tsx).
  const totals: [string, string][] = [["Subtotal:", formatMoney(order.subtotalMinor)]];
  if (order.discountMinor > 0n) totals.push(["Discount:", `-${formatMoney(order.discountMinor)}`]);
  totals.push(["Shipping:", order.shippingMinor > 0n ? formatMoney(order.shippingMinor) : (order.shippingMethodTitle ?? "Free shipping")]);
  for (const fee of fees) totals.push([`${fee.label}:`, formatMoney(fee.amountMinor)]);
  totals.push(["Payment method:", order.paymentMethodTitle], ["Total:", formatMoney(order.totalMinor)]);
  out += totals.map(([label, value]) => `${label} ${value}\n`).join("");
  if (order.customerNote) out += `\nNote:\n${order.customerNote}\n`;
  if (sentToAdmin) out += `\nView order: ${siteUrl}/admin/orders/${order.orderNumber}/\n`;
  return out;
}

/**
 * woocommerce_email_order_meta: the owner's checkout fields (delivery slot, snippet 6140; delivery location,
 * snippet 6865), so whoever packs the order sees them. The staff's copy also gets the map link.
 */
function orderMeta(view: View, sentToAdmin: boolean): string {
  const { order } = view;
  const location = order.deliveryLocation as { address?: string; lat?: string; lng?: string } | null;
  const lines: string[] = [];
  if (order.deliveryDay) lines.push(`Delivery day: ${deliveryDayLabel(order.deliveryDay)}`);
  if (order.deliveryTimeSlot) lines.push(`Time slot: ${deliveryTimeLabel(order.deliveryTimeSlot)}`);
  if (location?.address) lines.push(`Delivery location: ${location.address}`);
  if (sentToAdmin && location?.lat && location?.lng) lines.push(`Coordinates: ${location.lat}, ${location.lng} (https://www.google.com/maps?q=${location.lat},${location.lng})`);
  return lines.map((line) => `${line}\n`).join("");
}

/** woocommerce_email_customer_details: emails/plain/email-addresses.php (no extra customer fields are set). */
function addresses(view: View): string {
  const billing = billingOf(view);
  const shipping = view.order.shipping as Address | null;
  let out = `\nBILLING ADDRESS\n\n${addressLines(billing).join("\n")}\n`;
  if (billing.phone) out += `${billing.phone}\n`;
  if (billing.email) out += `${billing.email}\n`;
  const shippingLines = addressLines(shipping);
  if (shippingLines.length) {
    out += `\nSHIPPING ADDRESS\n\n${shippingLines.join("\n")}\n`;
    if (shipping?.phone) out += `${shipping.phone}\n`;
  }
  return out;
}

/** The frame every order e-mail shares: heading, opening, the order, the addresses, the closing text, the footer. */
function compose(view: View, { heading, opening, sentToAdmin, closing }: { heading: string; opening: string[]; sentToAdmin: boolean; closing: string }): string {
  return [
    `${BANNER}\n${heading}\n${BANNER}\n\n`,
    `${opening.join("\n\n")}\n\n`,
    orderDetails(view, sentToAdmin),
    `\n${RULE}\n\n`,
    orderMeta(view, sentToAdmin),
    addresses(view),
    `\n\n${RULE}\n\n`,
    closing ? `${closing}\n\n${RULE}\n\n` : "",
    FOOTER,
  ].join("");
}

// ---------------------------------------------------------------------------------------------
// The designed (HTML) version: the same texts, laid out in the shop's look (src/lib/email/html.ts).
// ---------------------------------------------------------------------------------------------

/** Pictures for the order's lines (item id → a public picture address), looked up by the sender. */
export type OrderEmailExtras = { images?: ReadonlyMap<string, string> };

const cell = (style: string, content: string, extra = "") => `<td ${extra}style="${style}">${content}</td>`;

function itemsHtml(view: View, images: ReadonlyMap<string, string> | undefined): string {
  const rows = view.items
    .map((item) => {
      const picture = images?.get(item.id);
      const thumb = picture
        ? `<img src="${esc(picture)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:8px;border:1px solid ${COLOR.line};object-fit:cover;">`
        : `<div style="width:56px;height:56px;border-radius:8px;background:${COLOR.goldSoft};"></div>`;
      const options = (item.options ?? []).map((o) => `<div style="font-size:12px;line-height:1.5;color:${COLOR.muted};">${esc(o.label)}: ${esc(o.value)}</div>`).join("");
      const border = `border-bottom:1px solid ${COLOR.line};`;
      return `<tr>
${cell(`padding:14px 0;${border}vertical-align:top;`, thumb, 'width="56" ')}
${cell(`padding:14px 12px;${border}vertical-align:top;font-family:${FONT.body};`, `<div style="font-size:14px;font-weight:700;line-height:1.4;color:${COLOR.ink};">${esc(item.productName)}</div>${options}<div style="font-size:12px;line-height:1.5;color:${COLOR.muted};">Qty ${item.quantity}</div>`)}
${cell(`padding:14px 0;${border}vertical-align:top;white-space:nowrap;font-family:${FONT.body};font-size:14px;font-weight:600;color:${COLOR.ink};`, esc(formatMoney(item.lineSubtotalMinor)), 'align="right" ')}
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR.line};">${rows}</table>`;
}

function totalsHtml(view: View): string {
  const { order, fees } = view;
  const rows: { label: string; value: string; tone?: "gold" }[] = [{ label: "Subtotal", value: formatMoney(order.subtotalMinor) }];
  if (order.discountMinor > 0n) rows.push({ label: "Discount", value: `-${formatMoney(order.discountMinor)}`, tone: "gold" });
  rows.push({ label: "Shipping", value: order.shippingMinor > 0n ? formatMoney(order.shippingMinor) : (order.shippingMethodTitle ?? "Free shipping") });
  for (const fee of fees) rows.push({ label: fee.label, value: formatMoney(fee.amountMinor) });
  rows.push({ label: "Payment method", value: order.paymentMethodTitle });
  const line = (row: (typeof rows)[number]) =>
    `<tr>${cell(`padding:5px 0;font-family:${FONT.body};font-size:14px;color:${COLOR.text};`, esc(row.label))}${cell(
      `padding:5px 0;font-family:${FONT.body};font-size:14px;color:${row.tone === "gold" ? COLOR.goldStrong : COLOR.ink};`,
      esc(row.value),
      'align="right" ',
    )}</tr>`;
  const total = `<tr>${cell(`padding:14px 0 0;border-top:2px solid ${COLOR.ink};font-family:${FONT.body};font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.ink};`, "Total")}${cell(
    `padding:14px 0 0;border-top:2px solid ${COLOR.ink};font-family:${FONT.display};font-size:24px;line-height:1;color:${COLOR.ink};white-space:nowrap;`,
    esc(formatMoney(order.totalMinor)),
    'align="right" ',
  )}</tr>`;
  const spacer = `<tr><td colspan="2" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 28px;">${rows.map(line).join("")}${spacer}${total}</table>`;
}

function deliveryHtml(view: View, sentToAdmin: boolean): string {
  const { order } = view;
  const location = order.deliveryLocation as { address?: string; lat?: string; lng?: string } | null;
  const rows: { label: string; value: string; link?: string }[] = [];
  if (order.deliveryDay) rows.push({ label: "Day", value: deliveryDayLabel(order.deliveryDay) });
  if (order.deliveryTimeSlot) rows.push({ label: "Time slot", value: deliveryTimeLabel(order.deliveryTimeSlot) });
  if (location?.address) rows.push({ label: "Location", value: location.address });
  if (sentToAdmin && location?.lat && location?.lng) rows.push({ label: "Map", value: `${location.lat}, ${location.lng}`, link: `https://www.google.com/maps?q=${location.lat},${location.lng}` });
  return infoBox("Delivery", rows);
}

function addressesHtml(view: View, sentToAdmin: boolean): string {
  const billing = billingOf(view);
  const shipping = view.order.shipping as Address | null;
  const billingLines = [...addressLines(billing), billing.phone ?? "", billing.email ?? ""].filter(Boolean);
  const shippingLines = [...addressLines(shipping), shipping?.phone ?? ""].filter(Boolean);
  const columns = twoColumns(addressBlock("Billing address", billingLines), addressBlock("Shipping address", shippingLines));
  if (!sentToAdmin || !billing.phone) return columns;
  // The staff can answer the customer straight from the e-mail.
  const whatsapp = `<a href="${href(`https://wa.me/${billing.phone.replace(/[^0-9]/g, "")}`)}" target="_blank" style="color:${COLOR.goldStrong};font-weight:700;">WhatsApp the customer</a>`;
  const mail = billing.email ? ` &nbsp;·&nbsp; <a href="mailto:${esc(billing.email)}" style="color:${COLOR.goldStrong};font-weight:700;">E-mail the customer</a>` : "";
  return `${columns}${paragraphHtml(`${whatsapp}${mail}`)}`;
}

/** How to pay, in the customer's e-mail (the gateway's instructions, as WooCommerce's offline gateways add them). */
function paymentHtml(view: View, status: "on-hold" | "processing"): string {
  const method = paymentMethods.find((m) => m.id === view.order.paymentMethod);
  if (!method?.instructions) return "";
  // Revolut and Wise wait on hold for the payment; COD is processing (the courier is paid).
  if ((status === "on-hold") !== (method.statusAfterOrder === "on-hold")) return "";
  const box = noteBox(`How to pay · ${method.title}`, method.instructions);
  if (method.id !== "sleeks_wise" && method.id !== "sleeks_revolut") return box;
  const message = `Hi, I've placed order #${view.order.orderNumber} using ${method.title}.\n\nPlease send me the payment details and confirm the exact amount.`;
  return `${box}${button("Get payment details on WhatsApp", whatsappLink(message), "dark")}`;
}

type HtmlParts = {
  eyebrow: string;
  heading: string;
  preheader: string;
  opening: string[];
  closing: string;
  sentToAdmin: boolean;
  step?: 1 | 2 | 3;
  payment?: "on-hold" | "processing";
  /** Extra content right after the opening (the shop's note). */
  lead?: string;
};

function composeHtml(view: View, subject: string, parts: HtmlParts, extras: OrderEmailExtras): string {
  const { order } = view;
  const n = order.orderNumber.toString();
  const cta = parts.sentToAdmin ? button("Open the order", `/admin/orders/${n}/`) : button("View your order", `/checkout/order-received/${n}/?key=${encodeURIComponent(order.orderKey)}`);
  const body = [
    ...parts.opening.map(paragraph),
    parts.lead ?? "",
    parts.step ? tracker(parts.step) : "",
    parts.payment ? paymentHtml(view, parts.payment) : "",
    cta,
    sectionTitle("Order summary", `#${n} · ${orderDate(view)}`),
    itemsHtml(view, extras.images),
    totalsHtml(view),
    deliveryHtml(view, parts.sentToAdmin),
    order.customerNote ? noteBox("Delivery instructions", order.customerNote) : "",
    addressesHtml(view, parts.sentToAdmin),
    // The customer's closing line ("…contact us at hello@…") is the help block, with WhatsApp added.
    parts.sentToAdmin ? (parts.closing ? paragraph(parts.closing) : "") : helpBlock(),
  ];
  return layout({
    title: subject,
    preheader: parts.preheader,
    eyebrow: parts.eyebrow,
    heading: parts.heading,
    body: body.filter(Boolean).join("\n"),
    reason: parts.sentToAdmin ? "Sent to the shop's order address." : "You’re receiving this e-mail because you placed an order on our shop.",
  });
}

/** One of the order e-mails for this order: WooCommerce's plain text and the designed version. */
export function orderEmail(kind: OrderEmailKind, view: View, extras: OrderEmailExtras = {}): OrderEmail {
  const { order } = view;
  const n = order.orderNumber.toString();
  const hi = `Hi ${firstName(view)},`;
  const summary = `${fullName(view) || "A customer"} · ${formatMoney(order.totalMinor)} · ${order.paymentMethodTitle}`;
  const admin = (subject: string, heading: string, opening: string, closing: string, eyebrow: string): OrderEmail => ({
    kind,
    audience: "admin",
    subject,
    text: compose(view, { heading, opening: [opening], sentToAdmin: true, closing }),
    html: composeHtml(view, subject, { eyebrow, heading, preheader: summary, opening: [opening], closing, sentToAdmin: true }, extras),
  });
  const customer = (subject: string, heading: string, sentence: string, parts: Pick<HtmlParts, "eyebrow" | "step" | "payment">, closing = THANKS): OrderEmail => ({
    kind,
    audience: "customer",
    subject,
    text: compose(view, { heading, opening: [hi, sentence, REMINDER], sentToAdmin: false, closing }),
    html: composeHtml(view, subject, { ...parts, heading, preheader: sentence, opening: [hi, sentence], closing, sentToAdmin: false }, extras),
  });
  switch (kind) {
    case "new_order":
      return admin(`[${SITE}]: You've got a new order: #${n}`, `New order: #${n}`, `You’ve received a new order from ${fullName(view)}:`, "Congratulations on the sale!", `New order · ${formatMoney(order.totalMinor)}`);
    case "cancelled_order":
      return admin(`[${SITE}]: Order #${n} has been cancelled`, `Order cancelled: #${n}`, `We’re getting in touch to let you know that order #${n} from ${fullName(view)} has been cancelled.`, "Thanks for reading.", `Order #${n} · Cancelled`);
    case "failed_order":
      return admin(
        `[${SITE}]: Order #${n} has failed`,
        `Order failed: #${n}`,
        `Unfortunately, the payment for order #${n} from ${fullName(view)} has failed. The order was as follows:`,
        "We hope they’ll be back soon! Read more about troubleshooting failed payments.",
        `Order #${n} · Failed`,
      );
    case "customer_on_hold_order":
      return customer(`Your ${SITE} order has been received!`, "Thank you for your order", "We’ve received your order and it’s currently on hold until we can confirm your payment has been processed.", {
        eyebrow: `Order #${n} · On hold`,
        step: 1,
        payment: "on-hold",
      });
    case "customer_processing_order":
      return customer(`Your ${SITE} order has been received!`, "Thank you for your order", "Just to let you know — we’ve received your order, and it is now being processed.", {
        eyebrow: `Order #${n} · Processing`,
        step: 2,
        payment: "processing",
      });
    case "customer_completed_order":
      return customer(`Your order from ${SITE} is on its way!`, "Good things are heading your way!", "We have finished processing your order.", { eyebrow: `Order #${n} · On its way`, step: 3 });
    case "customer_refunded_order":
      return customer(`Your ${SITE} order #${n} has been refunded`, `Order refunded: ${n}`, `Your order from ${SITE} has been refunded.`, { eyebrow: `Order #${n} · Refunded` }, `If you need any help with your order, please contact us at ${STORE_EMAIL}.`);
  }
}

/** The "Customer note" e-mail (WC_Email_Customer_Note): sent when the shop adds a "Note to customer" to an order. */
export function customerNoteEmail(view: View, note: string, extras: OrderEmailExtras = {}): { subject: string; text: string; html: string } {
  const subject = `A note has been added to your order from ${SITE}`;
  const heading = "A note has been added to your order";
  return {
    subject,
    text: compose(view, {
      heading,
      opening: [`Hi ${firstName(view)},`, `The following note has been added to your order:\n\n----------\n\n${note}\n\n----------`, "As a reminder, here are your order details:"],
      sentToAdmin: false,
      closing: THANKS,
    }),
    html: composeHtml(
      view,
      subject,
      {
        eyebrow: `Order #${view.order.orderNumber} · Update`,
        heading,
        preheader: note.slice(0, 120),
        opening: [`Hi ${firstName(view)},`, "The following note has been added to your order:"],
        lead: noteBox(`Note from ${SITE}`, note),
        closing: THANKS,
        sentToAdmin: false,
      },
      extras,
    ),
  };
}
