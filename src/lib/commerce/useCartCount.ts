"use client";

/**
 * The number on the header's and the floating cart's icon, read from the cart cookie in the browser
 * (cart-cookie.ts). The page is built in advance with 0; after it loads, and after every change to the
 * cart (CART_CHANGED_EVENT), the real count is shown, as WooCommerce's cart fragments do.
 */
import { useEffect, useState } from "react";

import { CART_CHANGED_EVENT, cartCount, readCartInBrowser } from "./cart-cookie";

export function useCartCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(cartCount(readCartInBrowser()));
    update();
    window.addEventListener(CART_CHANGED_EVENT, update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return count;
}

/** Tells every cart count (and anything else listening) that the cart cookie changed. */
export function announceCartChange() {
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}
