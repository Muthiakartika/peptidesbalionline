/**
 * What a cart holds (product, variation, quantity) → priced cart lines. Prices, names, stock and
 * categories always come from the catalogue on the server, never from the browser. Today the catalogue
 * is the live snapshot (src/lib/catalog); Phase 4/5 swaps in Postgres prices without changing this API.
 * Messages are WooCommerce's English texts. No product is on sale on the live shop (no sale prices in
 * the snapshot), so `onSale` is false for every line.
 */
import "server-only";

import { getCatalogState, getProductById, type Category, type Product, type Variation } from "@/lib/catalog";
import { isPurchasableVariation } from "@/lib/catalog/purchasable";

import type { CartLine } from "./coupons";

export type CartEntry = { productId: number; variationId: number | null; quantity: number };

export type PricedLine = CartLine & {
  product: Product;
  /** The chosen variation (its image and attributes); null for simple products. */
  variation: Variation | null;
  /** The chosen options as the cart lists them: [{ label: "Pen Type", value: "Disposable Pen" }, …]. */
  options: { label: string; value: string }[];
  /** The chosen options in one line, e.g. "Pen Type: Disposable Pen, MG: 5 MG"; null for simple products. */
  variantLabel: string | null;
  /** Out of stock since it was added: it stays in the cart, but the order can't be placed. */
  outOfStock: boolean;
  /**
   * On backorder (stock settings in /admin/products/; migrated from the live shop): "notify" when the
   * product is set to "Allow, but notify customer". null: in stock.
   */
  backorder: { notify: boolean } | null;
};

/** WooCommerce's quantity range for one line (the cart table's number field). */
export const MAX_QUANTITY = 9999;

export const lineKey = (productId: number, variationId: number | null) => `${productId}:${variationId ?? 0}`;

/** A category slug and all its parents' slugs (WooCommerce's wc_get_product_cat_ids). */
function withParents(slugs: string[], categories: Category[]): string[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const all = new Set<string>();
  for (const slug of slugs) {
    let category = bySlug.get(slug);
    while (category && !all.has(category.slug)) {
      all.add(category.slug);
      category = byId.get(category.parent);
    }
  }
  return [...all];
}

function variationOf(product: Product, variationId: number | null) {
  if (product.type === "simple") return variationId === null || variationId === 0 ? null : undefined;
  return product.variations.find((v) => v.id === variationId);
}

function variantOptions(product: Product, attributes: Record<string, string>): { label: string; value: string }[] {
  return product.quickShop.map((attribute) => {
    const value = attributes[attribute.name];
    const option = attribute.options.find((o) => o.value === value);
    return { label: attribute.label, value: option?.label ?? value };
  });
}

export type AddCheck =
  | { ok: true; entry: CartEntry }
  | { ok: false; error: string; /** "Please choose product options": link to the product page. */ link?: { href: string; text: string } };

/** "Add to cart": can this product / variation be added in this quantity? */
export async function checkAddToCart(productId: number, variationId: number | null, quantity: number): Promise<AddCheck> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return { ok: false, error: "Please enter a valid quantity." };
  const product = await getProductById(productId);
  if (!product) return { ok: false, error: "Sorry, this product cannot be purchased." };
  if (product.type === "variable" && !variationId) {
    return { ok: false, error: "Please choose product options by visiting", link: { href: product.path, text: product.name } };
  }
  const variation = variationOf(product, variationId);
  // A variation without a price is never for sale (src/lib/catalog/purchasable.ts).
  if (variation === undefined || (variation && !isPurchasableVariation(variation))) return { ok: false, error: "Sorry, this product cannot be purchased." };
  const inStock = variation ? variation.inStock : product.inStock;
  if (!inStock) return { ok: false, error: `You cannot add "${product.name}" to the cart because the product is out of stock.` };
  return { ok: true, entry: { productId, variationId: variation ? variation.id : null, quantity } };
}

/**
 * The cart's lines with today's prices, as WooCommerce rebuilds a cart:
 *   * a product that can't be bought any more (gone, or its variation gone) is removed, with a notice;
 *   * a product now out of stock stays, with an error that blocks the checkout (`errors`);
 *   * the same product twice becomes one line.
 */
export async function priceCart(entries: CartEntry[]): Promise<{ lines: PricedLine[]; notices: string[]; errors: string[] }> {
  const catalog = await getCatalogState();
  const merged = new Map<string, CartEntry>();
  for (const entry of entries) {
    const key = lineKey(entry.productId, entry.variationId);
    const previous = merged.get(key);
    merged.set(key, { ...entry, quantity: Math.min(MAX_QUANTITY, (previous?.quantity ?? 0) + entry.quantity) });
  }
  const lines: PricedLine[] = [];
  const notices: string[] = [];
  const errors: string[] = [];
  for (const [key, entry] of merged) {
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) continue;
    const product = catalog.byId.get(entry.productId);
    const variation = product ? variationOf(product, entry.variationId) : undefined;
    if (!product || variation === undefined || (product.type === "variable" && !variation) || (variation && !isPurchasableVariation(variation))) {
      notices.push(`${product?.name ?? "A product"} has been removed from your cart because it can no longer be purchased. Please contact us if you need assistance.`);
      continue;
    }
    const outOfStock = !(variation ? variation.inStock : product.inStock);
    const options = variation ? variantOptions(product, variation.attributes) : [];
    if (outOfStock) errors.push(`Sorry, "${product.name}" is not in stock. Please edit your cart and try again. We apologize for any inconvenience caused.`);
    lines.push({
      key,
      productId: product.id,
      variationId: variation ? variation.id : null,
      name: product.name,
      categories: withParents(product.categories, catalog.categories),
      // On sale (a sale price set in /admin/products/): coupons that exclude sale items skip it.
      onSale: Boolean(variation ? variation.onSale : product.onSale),
      unitPrice: variation ? variation.price : product.priceMin,
      quantity: entry.quantity,
      product,
      variation,
      options,
      variantLabel: options.length ? options.map((o) => `${o.label}: ${o.value}`).join(", ") : null,
      outOfStock,
      backorder: catalog.backorder[String(variation ? variation.id : product.id)] ?? null,
    });
  }
  return { lines, notices, errors };
}
