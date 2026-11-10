/**
 * When a price is shown struck through (WooCommerce's wc_format_sale_price): a single price with a
 * higher regular price. A price range never is (WooCommerce shows the range). Safe in the browser.
 */
export function struckRegular(min: bigint, max: bigint, regular: bigint | string | null | undefined): bigint | null {
  if (regular === undefined || regular === null || min !== max) return null;
  const value = typeof regular === "string" ? BigInt(regular) : regular;
  return value > min ? value : null;
}
