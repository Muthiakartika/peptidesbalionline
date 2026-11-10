/**
 * The "Cancel" link of an order: /cart/?cancel_order=true&order=wc_order_…&order_id=<n>&redirect=…&_wpnonce=…
 * (WooCommerce's get_cancel_order_url; src/proxy.ts sends that address here). As WC_Form_Handler::cancel_order:
 * the customer's own order, still "Pending payment" or "Failed", with the link's token → "Cancelled", a note
 * "Order cancelled by customer." and "Your order was cancelled."; otherwise "Your order can no longer be
 * cancelled. Please contact us if you need assistance." Then back to My Account.
 */
import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { encodeNotices, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, notice } from "@/lib/account/notices";
import { cancelToken, getOrderWithLines, needsPayment, setOrderStatus } from "@/lib/commerce/orders";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const back = query.get("redirect") ?? "/my-account/";
  const response = NextResponse.redirect(new URL(/^\/(?!\/)/.test(back) ? back : "/my-account/", request.nextUrl), 302);
  const say = (list: ReturnType<typeof notice.error>[]) => response.cookies.set(FLASH_COOKIE, encodeNotices(list), { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" });
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    const key = query.get("order") ?? "";
    const view = session && key.startsWith("wc_order_") ? await getOrderWithLines(query.get("order_id") ?? "", { key }) : null;
    const allowed = view && view.order.userId === session?.user.id && query.get("_wpnonce") === cancelToken(key, session!.session.token);
    if (!view || !allowed) return response; // WooCommerce does nothing for a link that isn't the customer's own.
    if (!needsPayment(view.order.status)) {
      say([notice.error("Your order can no longer be cancelled. Please contact us if you need assistance.")]);
      return response;
    }
    await setOrderStatus(view.order.id, "cancelled", "Order cancelled by customer.");
    say([notice.info("Your order was cancelled.")]);
  } catch (error) {
    console.error("[cancel-order] failed", error);
  }
  return response;
}
