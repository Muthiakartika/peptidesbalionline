/**
 * One applied coupon in the totals, after "Subtotal" (WooCommerce 11.2.1 cart/cart-totals.php and
 * checkout/review-order.php, wc_cart_totals_coupon_label / wc_cart_totals_coupon_html):
 *   <tr class="cart-discount coupon-<code>"><th>Coupon: <code></th><td>-<price> <a>[Remove]</a></td></tr>
 * A free-shipping coupon that takes nothing off reads "Free shipping coupon". The cart page's cell also has
 * data-title (its table turns into cards on phones). The owner's USD snippet doesn't touch this row.
 * Measured against live (guest cart + the 5% welcome coupon, 7 Nov 2026): the price has no <bdi> there, and
 * "[Remove]" is the theme's 30 × 30 × icon (cart.css).
 */
import type { ReactNode } from "react";

import { sanitizeTitle } from "@/lib/commerce/coupons";

import { CouponAmount } from "./CartPrice";

export function CouponRow({ code, amount, freeShipping, withDataTitle = false, remove }: { code: string; amount: bigint; freeShipping: boolean; withDataTitle?: boolean; remove: ReactNode }) {
  const label = `Coupon: ${code}`;
  return (
    <tr className={`cart-discount coupon-${sanitizeTitle(code)}`}>
      <th>{label}</th>
      <td {...(withDataTitle ? { "data-title": label } : {})}>
        {freeShipping && amount === 0n ? (
          "Free shipping coupon"
        ) : (
          <>
            -<CouponAmount value={amount} />
          </>
        )}{" "}
        {remove}
      </td>
    </tr>
  );
}
