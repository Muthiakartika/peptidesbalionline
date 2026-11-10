"use client";

/** Adds the product to this visitor's "recently viewed" list (shown on the homepage). */
import { useEffect } from "react";

import { rememberViewed } from "@/lib/recently-viewed";

export function TrackRecentlyViewed({ productId }: { productId: number }) {
  useEffect(() => rememberViewed(productId), [productId]);
  return null;
}
