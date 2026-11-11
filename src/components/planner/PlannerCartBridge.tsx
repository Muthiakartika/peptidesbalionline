"use client";

/**
 * After "Add all to cart", the Protocol Builder's script tells the theme's mini carts the cart
 * changed (WooCommerce's "wc-blocks_added_to_cart" event on <body>; jQuery's "added_to_cart" too,
 * but this site has no jQuery). This passes it on to this site's cart counts in the header and the
 * floating cart button (they read the cart cookie again).
 */
import { useEffect } from "react";

import { announceCartChange } from "@/lib/commerce/useCartCount";

export function PlannerCartBridge() {
  useEffect(() => {
    document.body.addEventListener("wc-blocks_added_to_cart", announceCartChange);
    return () => document.body.removeEventListener("wc-blocks_added_to_cart", announceCartChange);
  }, []);
  return null;
}
