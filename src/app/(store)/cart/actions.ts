"use server";

/**
 * The cart's Server Actions: add, change a quantity, remove. Each one reads the cart cookie, checks
 * the request against the catalogue (cart-lines.ts) and saves the cookie again; Next.js then renders
 * the current page again with the new cart. Messages are WooCommerce's.
 */
import { z } from "zod";

import { cartCount, type StoredCart } from "@/lib/commerce/cart-cookie";
import { cartCouponState, withoutCoupons } from "@/lib/commerce/cart-coupons";
import { checkAddToCart, lineKey, MAX_QUANTITY, priceCart } from "@/lib/commerce/cart-lines";
import { readCart, writeCart } from "@/lib/commerce/cart-store";
import { couponMessages } from "@/lib/commerce/coupons";
import { indonesiaStates } from "@/lib/commerce/store-settings";

/** `couponNotices`: WooCommerce's notices for coupons the change made invalid (they are removed). */
export type CartActionResult =
  | { ok: true; count: number; couponNotices?: string[] }
  | { ok: false; count: number; error: string; link?: { href: string; text: string } };

/**
 * Saves the cart after its items changed, as WooCommerce's cart check does: a coupon the new contents
 * make invalid (e.g. under its minimum spend) is removed, with "Sorry, it seems the coupon … is invalid".
 */
async function saveChangedCart(cart: StoredCart): Promise<string[]> {
  // WooCommerce doesn't check the coupons of an empty cart: they stay, and count again after "Undo?".
  const { lines } = await priceCart(cart.items);
  const state = lines.length ? await cartCouponState(cart, lines) : null;
  await writeCart(state?.removedCodes.length ? withoutCoupons(cart, state.removedCodes) : cart);
  return state && !state.failed ? state.notices : [];
}

const id = z.number().int().positive();
const addInput = z.object({ productId: id, variationId: id.nullable(), quantity: z.number().int().min(1).max(MAX_QUANTITY) });
const quantityInput = z.object({ key: z.string().regex(/^\d+:\d+$/), quantity: z.number().int().min(0).max(MAX_QUANTITY) });

export async function addToCart(productId: number, variationId: number | null, quantity: number): Promise<CartActionResult> {
  const cart = await readCart();
  const input = addInput.safeParse({ productId, variationId, quantity });
  if (!input.success) return { ok: false, count: cartCount(cart), error: "Please enter a valid quantity." };
  const check = await checkAddToCart(input.data.productId, input.data.variationId, input.data.quantity);
  if (!check.ok) return { ok: false, count: cartCount(cart), error: check.error, ...(check.link ? { link: check.link } : {}) };
  const key = lineKey(check.entry.productId, check.entry.variationId);
  const existing = cart.items.find((item) => lineKey(item.productId, item.variationId) === key);
  if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + check.entry.quantity);
  else cart.items.push(check.entry);
  const couponNotices = await saveChangedCart(cart);
  return { ok: true, count: cartCount(cart), couponNotices };
}

/** A new quantity for a cart line; 0 removes it (as WooCommerce's cart form does). */
export async function setCartQuantity(key: string, quantity: number): Promise<CartActionResult> {
  const cart = await readCart();
  const input = quantityInput.safeParse({ key, quantity });
  if (!input.success) return { ok: false, count: cartCount(cart), error: "Please enter a valid quantity." };
  cart.items = cart.items.flatMap((item) => {
    if (lineKey(item.productId, item.variationId) !== input.data.key) return [item];
    return input.data.quantity > 0 ? [{ ...item, quantity: input.data.quantity }] : [];
  });
  const couponNotices = await saveChangedCart(cart);
  return { ok: true, count: cartCount(cart), couponNotices };
}

export async function removeFromCart(key: string): Promise<CartActionResult> {
  return setCartQuantity(key, 0);
}

/** "[Remove]" next to a coupon in the totals (WC_AJAX::remove_coupon): "Coupon has been removed." */
export async function removeCartCoupon(code: string): Promise<{ ok: boolean; notice: string }> {
  const formatted = typeof code === "string" ? code.trim().toLowerCase().slice(0, 100) : "";
  if (!formatted) return { ok: false, notice: "Sorry there was a problem removing this coupon." };
  const cart = await readCart();
  await writeCart(withoutCoupons(cart, [formatted]));
  return { ok: true, notice: couponMessages.removed };
}

/** One line of the side cart (strings only: amounts are minor units as text). */
export type MiniCartLine = {
  key: string;
  productId: number;
  variationId: number | null;
  quantity: number;
  name: string;
  href: string;
  image: { src: string; alt: string };
  options: { label: string; value: string }[];
  /** On backorder on live: the owner's badge under the quantity line. */
  backorder: boolean;
  unitPrice: string;
};

export type MiniCart = { lines: MiniCartLine[]; subtotal: string; count: number };

/** WordPress's 300×300 product thumbnail ("woocommerce_thumbnail") of an image URL. */
const thumbnail = (src: string) => src.replace(/-\d+x\d+(\.\w+)$/, "-300x300$1");

/** The side cart's content (WooCommerce's mini cart), read when it opens and after each change. */
export async function getMiniCart(): Promise<MiniCart> {
  const cart = await readCart();
  const { lines } = await priceCart(cart.items);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * BigInt(line.quantity), 0n);
  return {
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: subtotal.toString(),
    lines: lines.map((line) => ({
      key: line.key,
      productId: line.productId,
      variationId: line.variationId,
      quantity: line.quantity,
      name: line.name,
      // A variation links to its product page with the chosen options (as live).
      href: line.variation ? `${line.product.path}?${new URLSearchParams(line.variation.attributes).toString()}` : line.product.path,
      image: line.variation?.image ? { src: line.variation.image.src, alt: line.variation.image.alt } : { src: thumbnail(line.product.image.src), alt: line.product.image.alt },
      options: line.options,
      backorder: line.backorder !== null,
      unitPrice: line.unitPrice.toString(),
    })),
  };
}

const destinationInput = z.object({
  country: z.literal("ID"),
  state: z.string().refine((code) => indonesiaStates.some(([value]) => value === code)),
  city: z.string().trim().max(100),
  postcode: z.string().trim().max(20),
});

/**
 * The cart's "Change address" form (WooCommerce's shipping calculator). Only Indonesia can be chosen,
 * as on live; every province has the same shipping, so this changes where "Shipping to …" points.
 */
export async function setShippingDestination(country: string, state: string, city: string, postcode: string): Promise<CartActionResult> {
  const cart = await readCart();
  if (country !== "ID") return { ok: false, count: cartCount(cart), error: "Please select a country / region." };
  const input = destinationInput.safeParse({ country, state, city, postcode });
  if (!input.success) return { ok: false, count: cartCount(cart), error: "Please enter a valid postcode / ZIP." };
  cart.destination = { state: input.data.state, city: input.data.city, postcode: input.data.postcode };
  await writeCart(cart);
  return { ok: true, count: cartCount(cart) };
}
