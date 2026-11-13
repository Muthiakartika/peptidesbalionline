/**
 * GET /api/dev/email-preview/ : every e-mail of the shop in its design (src/lib/email/), with a made-up order
 * and two real products' pictures, so the design can be checked in a browser without sending anything.
 * ?kind=new_order (or any other) shows one e-mail, &format=text its plain-text copy, &send=1 sends it to the
 * test inbox (EMAIL_TEST_TO) to see it in a real e-mail app; that one only from this computer (localhost).
 *
 * Only on test sites: on the live site (SITE_ENV=production) this address doesn't exist. Nothing here reads
 * or writes real orders or customers.
 */
import type { NextRequest } from "next/server";

import { getAllProducts } from "@/lib/catalog";
import type { OrderView } from "@/lib/commerce/orders";
import { sendEmail } from "@/lib/email";
import { newAccountEmail, resetPasswordEmail } from "@/lib/email/account-emails";
import { coaLinksHtml } from "@/lib/email/coa-email";
import { esc } from "@/lib/email/html";
import { customerNoteEmail, orderEmail, type OrderEmailKind } from "@/lib/email/order-emails";
import { mediaUrl } from "@/lib/media/url";
import { siteUrl } from "@/lib/site";

const ORDER_KINDS: OrderEmailKind[] = ["customer_on_hold_order", "customer_processing_order", "customer_completed_order", "customer_refunded_order", "new_order", "cancelled_order", "failed_order"];
const OTHER_KINDS = ["customer_note", "new_account", "reset_password", "coa_links"] as const;

const rp = (rupiah: number) => BigInt(rupiah) * 100n;

async function sample(paymentMethod: string) {
  const products = (await getAllProducts()).slice(0, 2);
  const names = products.length === 2 ? products.map((p) => p.name) : ["BPC-157 10mg", "TB-500 10mg"];
  const items = names.map((name, index) => ({
    id: `item-${index}`,
    productName: name,
    quantity: index === 0 ? 2 : 1,
    lineSubtotalMinor: rp(index === 0 ? 1_700_000 : 950_000),
    options: index === 0 ? [{ label: "Dosage", value: "10mg" }] : [],
  }));
  const images = new Map<string, string>();
  products.forEach((product, index) => {
    const src = mediaUrl(product.searchImage?.src ?? product.image?.src ?? "");
    if (src) images.set(`item-${index}`, src.startsWith("/") ? `${siteUrl}${src}` : src);
  });
  const method = { sleeks_wise: "Wise", cod: "COD in Bali", atlas_card: "Card" }[paymentMethod] ?? "Wise";
  const view = {
    order: {
      orderNumber: 12900n,
      orderKey: "wc_order_preview000000",
      createdAt: new Date(),
      billing: { firstName: "Made Example", lastName: "", address1: "Jl. Pantai Berawa 12", city: "Canggu", state: "BA", postcode: "80361", country: "ID", phone: "+628123456789", email: "made@example.com" },
      shipping: { firstName: "Made Example", lastName: "", address1: "Jl. Pantai Berawa 12", city: "Canggu", state: "BA", postcode: "80361", country: "ID", phone: "" },
      subtotalMinor: rp(4_350_000),
      discountMinor: rp(250_000),
      shippingMinor: 0n,
      shippingMethodTitle: "Free shipping",
      paymentMethod,
      paymentMethodTitle: method,
      totalMinor: rp(4_100_000),
      customerNote: "Villa gate is green, please ring twice.",
      deliveryDay: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      deliveryTimeSlot: "10:00-12:00",
      deliveryLocation: { address: "Jl. Pantai Berawa No.12, Tibubeneng, Kuta Utara, Badung, Bali 80361, Indonesia", lat: "-8.6560000", lng: "115.1380000" },
    },
    items,
    fees: [],
  } as unknown as NonNullable<OrderView>;
  return { view, extras: { images } };
}

function index(): Response {
  const links = [...ORDER_KINDS, ...OTHER_KINDS]
    .map((kind) => `<li><a href="?kind=${kind}">${kind}</a> · <a href="?kind=${kind}&format=text">text</a> · <a href="?kind=${kind}&send=1">send to the test inbox</a></li>`)
    .join("");
  return new Response(`<!DOCTYPE html><meta charset="utf-8"><title>E-mail previews</title><body style="font-family:sans-serif;padding:24px"><h1>E-mail previews (test sites only)</h1><ul>${links}</ul></body>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  if (process.env.SITE_ENV === "production") return new Response("Not found", { status: 404 });
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  const asText = request.nextUrl.searchParams.get("format") === "text";
  if (!kind) return index();
  const { view, extras } = await sample(request.nextUrl.searchParams.get("pay") ?? (kind === "customer_processing_order" ? "cod" : "sleeks_wise"));
  const link = `${siteUrl}/my-account/lost-password/?key=preview&id=preview`;
  let mail: { text: string; html: string } | null = null;
  if ((ORDER_KINDS as string[]).includes(kind)) mail = orderEmail(kind as OrderEmailKind, view, extras);
  else if (kind === "customer_note") mail = customerNoteEmail(view, "Your parcel left our Canggu studio at 09:30 and should arrive before noon.", extras);
  else if (kind === "new_account") mail = newAccountEmail({ displayName: "made.example", username: "made.example", link });
  else if (kind === "reset_password") mail = resetPasswordEmail({ displayName: "made.example", username: "made.example", link });
  else if (kind === "coa_links") {
    const { getCoas } = await import("@/lib/coa/library");
    const coas = (await getCoas()).slice(0, 2);
    mail = { text: "(see /lab-results-certificates-of-analysis/)", html: coaLinksHtml("Atlas Longevity: COA verification links (2)", coas, `${siteUrl}/lab-results-certificates-of-analysis/#result`) };
  }
  if (!mail) return new Response(`Unknown e-mail: ${esc(kind)}`, { status: 404 });
  if (request.nextUrl.searchParams.get("send") === "1") {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname)) return new Response("Sending previews only works on this computer.", { status: 403 });
    // On a test site sendEmail delivers only to EMAIL_TEST_TO (or saves the e-mail in .data/mail/).
    const result = await sendEmail({ to: "made@example.com", subject: `Preview: ${kind}`, text: mail.text, html: mail.html });
    return new Response(`Preview "${kind}": ${result}`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return asText ? new Response(mail.text, { headers: { "content-type": "text/plain; charset=utf-8" } }) : new Response(mail.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
