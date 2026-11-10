/**
 * Reading and saving the visitor's cart on the server (the cookie, cart-cookie.ts). Writing only works
 * in a Server Action or Route Handler (Next.js rule for cookies).
 */
import "server-only";

import { cookies } from "next/headers";

import { CART_COOKIE, CART_MAX_AGE_SECONDS, decodeCart, encodeCart, type StoredCart } from "./cart-cookie";

export async function readCart(): Promise<StoredCart> {
  return decodeCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function writeCart(cart: StoredCart): Promise<void> {
  const store = await cookies();
  if (!cart.items.length && !cart.coupons.length && !cart.destination) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, encodeCart(cart), {
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://"),
    // Readable by the header's cart count (no secrets inside).
    httpOnly: false,
  });
}
