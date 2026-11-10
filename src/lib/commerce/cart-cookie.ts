/**
 * The cart cookie: what a visitor's cart holds, until carts move to the database (Neon, Phase 5).
 * Only product IDs, variation IDs, quantities and coupon codes: prices are always worked out again on
 * the server (cart-lines.ts), so changing the cookie can't change a price. Not secret, so the header's
 * cart count can read it in the browser (like WooCommerce's "woocommerce_items_in_cart" cookie).
 * Kept like WooCommerce keeps a guest's cart: 48 hours after the last change.
 * Shared by the server (cart-store.ts) and the browser (the header count): no "server-only" here.
 */
import { z } from "zod";

import type { CartEntry } from "./cart-lines";

export const CART_COOKIE = "atlas_cart";
export const CART_MAX_AGE_SECONDS = 48 * 60 * 60;
/** Sent by the browser code after the cart changed, so every cart count reads the cookie again. */
export const CART_CHANGED_EVENT = "atlas-cart-changed";

/** Where the cart ships to, from the cart's "Change address" (Indonesia only: province code, city, postcode). */
export type Destination = { state: string; city: string; postcode: string };

export type StoredCart = { items: CartEntry[]; coupons: string[]; destination?: Destination };

const stored = z.object({
  v: z.literal(1),
  // [product ID, variation ID (0 = none), quantity]
  items: z.array(z.tuple([z.number().int().positive(), z.number().int().nonnegative(), z.number().int().min(1).max(9999)])).max(100),
  coupons: z.array(z.string().min(1).max(100)).max(20),
  // [province code, city, postcode]
  d: z.tuple([z.string().max(4), z.string().max(100), z.string().max(20)]).optional(),
});

export const emptyCart = (): StoredCart => ({ items: [], coupons: [] });

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeCart(cart: StoredCart): string {
  const { destination } = cart;
  return toBase64Url(
    JSON.stringify({
      v: 1,
      items: cart.items.map((item) => [item.productId, item.variationId ?? 0, item.quantity]),
      coupons: cart.coupons,
      ...(destination ? { d: [destination.state, destination.city, destination.postcode] } : {}),
    }),
  );
}

/** A broken or old cookie counts as an empty cart (as an expired WooCommerce session does). */
export function decodeCart(value: string | undefined | null): StoredCart {
  if (!value) return emptyCart();
  try {
    const parsed = stored.safeParse(JSON.parse(fromBase64Url(value)));
    if (!parsed.success) return emptyCart();
    const [state, city, postcode] = parsed.data.d ?? [];
    return {
      items: parsed.data.items.map(([productId, variationId, quantity]) => ({ productId, variationId: variationId || null, quantity })),
      coupons: parsed.data.coupons,
      ...(state !== undefined ? { destination: { state, city: city ?? "", postcode: postcode ?? "" } } : {}),
    };
  } catch {
    return emptyCart();
  }
}

/** The number on the cart icons: all quantities added up (WooCommerce's cart contents count). */
export function cartCount(cart: StoredCart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** In the browser: the cart in document.cookie. */
export function readCartInBrowser(): StoredCart {
  if (typeof document === "undefined") return emptyCart();
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${CART_COOKIE}=`));
  return decodeCart(match ? decodeURIComponent(match.slice(CART_COOKIE.length + 1)) : null);
}
