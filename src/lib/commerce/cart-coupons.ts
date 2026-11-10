/**
 * The visitor's applied coupons, checked for the current cart (pages and Server Actions use this). A cart
 * without coupons never touches the database. When the database can't be reached the coupons are left out
 * of the totals (and kept in the cart) with a plain message, never counted blindly.
 */
import "server-only";

import { getAccountUser } from "@/lib/account/session";

import type { StoredCart } from "./cart-cookie";
import type { CartLine } from "./coupons";
import { checkCartCoupons, couponCustomer, type CartCouponCheck, type CouponCustomer } from "./coupon-store";

export const COUPON_CHECK_FAILED = "Your coupon couldn't be checked: the shop's database can't be reached right now. Please try again in a moment.";

export type CartCouponState = CartCouponCheck & { customer: CouponCustomer | null; failed: boolean };

export async function cartCouponState(cart: StoredCart, lines: CartLine[], billingEmail = ""): Promise<CartCouponState> {
  if (!cart.coupons.length) return { coupons: [], removedCodes: [], notices: [], customer: null, failed: false };
  try {
    const user = await getAccountUser().catch(() => null);
    const customer = await couponCustomer(user, billingEmail);
    return { ...(await checkCartCoupons(cart.coupons, lines, customer)), customer, failed: false };
  } catch (error) {
    console.error("[coupons] check failed", error);
    return { coupons: [], removedCodes: [], notices: [COUPON_CHECK_FAILED], customer: null, failed: true };
  }
}

/** The cart without some coupons (codes compared as WooCommerce formats them). */
export function withoutCoupons(cart: StoredCart, codes: string[]): StoredCart {
  const drop = new Set(codes.map((code) => code.trim().toLowerCase()));
  return { ...cart, coupons: cart.coupons.filter((code) => !drop.has(code.trim().toLowerCase())) };
}
