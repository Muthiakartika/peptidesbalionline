/**
 * Today's date for the product offers' "valid until" (WooCommerce: 31 December of next year,
 * src/lib/seo/product-offer.ts). Product pages are prerendered, where Cache Components doesn't allow
 * reading the clock directly: the date is cached instead and renewed daily, which is all a year-end needs.
 */
import "server-only";

import { cacheLife } from "next/cache";

export async function offerDate(): Promise<string> {
  "use cache";
  cacheLife("days");
  return new Date().toISOString();
}
