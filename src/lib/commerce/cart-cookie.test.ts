/**
 * The cart cookie: what goes in comes out, the count adds quantities, and a broken or forged cookie
 * is just an empty cart (prices never come from it: cart-lines.ts reads them from the catalogue).
 */
import { describe, expect, it } from "vitest";

import { cartCount, decodeCart, encodeCart, type StoredCart } from "./cart-cookie";

describe("cart cookie", () => {
  it("keeps items, coupons and the destination", () => {
    const cart: StoredCart = {
      items: [
        { productId: 1234, variationId: null, quantity: 2 },
        { productId: 4704, variationId: 9752, quantity: 1 },
      ],
      coupons: ["welcome5"],
      destination: { state: "JI", city: "Surabaya", postcode: "60111" },
    };
    expect(decodeCart(encodeCart(cart))).toEqual(cart);
    expect(cartCount(cart)).toBe(3);
    expect(encodeCart(cart)).toMatch(/^[A-Za-z0-9_-]+$/); // safe in a cookie
  });

  it("reads anything broken or out of range as an empty cart", () => {
    const empty = { items: [], coupons: [] };
    expect(decodeCart(undefined)).toEqual(empty);
    expect(decodeCart("not-base64-json")).toEqual(empty);
    const forged = Buffer.from(JSON.stringify({ v: 1, items: [[1234, 0, 1_000_000]], coupons: [] })).toString("base64url");
    expect(decodeCart(forged)).toEqual(empty);
    const priced = Buffer.from(JSON.stringify({ v: 1, items: [[1234, 0, 1, 5]], coupons: [] })).toString("base64url");
    expect(decodeCart(priced)).toEqual(empty);
  });
});
