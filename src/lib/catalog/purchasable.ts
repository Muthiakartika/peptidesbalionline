/**
 * Can this variation be bought? WooCommerce never sells a variation without a price: it leaves it
 * out of the product's variation list, so choosing those options shows "Sorry, no products matched
 * your selection" (e.g. CJC-1295 DAC 5mg's "10 MG" and TB-500's "Any MG" on the live site).
 * The rebuild stores such a variation with price 0, so every place that picks or adds a variation
 * checks this first: the product form, the quick-shop on product cards, the search suggestions,
 * the cart and the Protocol Builder's cart. No server-only imports: the browser uses it too.
 */
export function isPurchasableVariation(variation: { price: bigint }): boolean {
  return variation.price > 0n;
}
