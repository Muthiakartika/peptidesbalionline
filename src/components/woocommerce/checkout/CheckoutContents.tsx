/**
 * The checkout's content for the visitor's cart (read from the cart cookie, so it is rendered for each
 * request, inside <Suspense> on the page): the cart priced again on the server, the delivery days of
 * today (UTC, as WordPress) and the owner's "order via WhatsApp" link, handed to the form.
 * A cart whose products are all gone goes back to /cart/, as WooCommerce does for an empty cart
 * (src/proxy.ts already does that for a cookie without items).
 */
import { redirect } from "next/navigation";

import { whatsappNumber } from "@/content/site-chrome";
import { getAccountUser } from "@/lib/account/session";
import { cartCouponState } from "@/lib/commerce/cart-coupons";
import { priceCart } from "@/lib/commerce/cart-lines";
import { readCart } from "@/lib/commerce/cart-store";
import { couponToData } from "@/lib/commerce/coupons";
import { deliveryDayOptions, deliveryTimeOptions } from "@/lib/commerce/delivery";

import { CartNotices } from "../cart/CartControls";

import { loadAddresses } from "../account/AccountSections";

import { CheckoutForm, type CheckoutCustomer, type ReviewLine } from "./CheckoutForm";

/**
 * The owner's snippet "WhatsApp order on checkout": its lines come out without line breaks on live
 * ("…via WhatsApp.Products in my cart:KPV 10mg × 1Please help…", 6 Nov 2026), so they are joined
 * the same way here.
 */
function whatsappOrderHref(lines: { name: string; quantity: number }[]): string {
  const text = ["Hello, I prefer to place my order via WhatsApp.", "Products in my cart:", ...lines.map((line) => `${line.name} × ${line.quantity}`), "Please help me complete my order."].join("");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export async function CheckoutContents() {
  const cart = await readCart();
  const { lines, notices, errors } = await priceCart(cart.items);
  if (!lines.length) redirect("/cart/");
  const review: ReviewLine[] = lines.map((line) => ({
    key: line.key,
    productId: line.productId,
    variationId: line.variationId,
    name: line.name,
    categories: line.categories,
    onSale: line.onSale,
    unitPrice: line.unitPrice.toString(),
    quantity: line.quantity,
    options: line.options,
  }));
  // A logged-in customer's saved billing address fills the form (WooCommerce's customer data).
  let customer: CheckoutCustomer | null = null;
  try {
    const user = await getAccountUser();
    if (user) {
      const billing = (await loadAddresses(user.id)).billing;
      customer = { billing: { email: user.email, first_name: [user.firstName, user.lastName].filter(Boolean).join(" "), ...(billing ? Object.fromEntries(Object.entries(billing).filter(([, v]) => v)) : {}) } };
    }
  } catch (error) {
    console.error("[checkout] session check failed", error);
  }
  // The applied coupons still valid for this cart; the form gets their rules only (couponToData).
  const coupons = await cartCouponState(cart, lines);
  return (
    <>
      <CartNotices serverErrors={[...notices, ...errors, ...coupons.notices]} />
      <CheckoutForm lines={review} coupons={coupons.coupons.map(couponToData)} deliveryDays={deliveryDayOptions()} deliveryTimes={deliveryTimeOptions()} whatsappHref={whatsappOrderHref(lines)} customer={customer} />
    </>
  );
}
