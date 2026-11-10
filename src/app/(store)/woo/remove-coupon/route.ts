/**
 * "[Remove]" next to a coupon, when it is followed as a link (before the page's script runs, or without
 * JavaScript): /cart/?remove_coupon=<code> or /checkout/?remove_coupon=<code> (src/proxy.ts sends both here,
 * with `back`). As WC_Form_Handler::update_cart_action: the coupon is removed from the cart and the browser
 * goes back to the page without the query (no notice on this path, as WooCommerce).
 */
import { NextResponse, type NextRequest } from "next/server";

import { withoutCoupons } from "@/lib/commerce/cart-coupons";
import { readCart, writeCart } from "@/lib/commerce/cart-store";

export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("remove_coupon") ?? "").trim().toLowerCase().slice(0, 100);
  const back = request.nextUrl.searchParams.get("back") === "/checkout/" ? "/checkout/" : "/cart/";
  if (code) await writeCart(withoutCoupons(await readCart(), [code]));
  return NextResponse.redirect(new URL(back, request.nextUrl), 302);
}
