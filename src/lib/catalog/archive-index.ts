/**
 * What src/proxy.ts needs to know about the shop before a page is rendered: which product addresses
 * exist, which category slugs exist, and how many products each listing has (to know its last page).
 * The shop routes are built in advance, and with Cache Components an address they don't know would
 * get the 404 page with status 200; the proxy sends those to a real 404 instead (as the live site
 * answers). Kept free of "server-only" so the proxy can import it; src/lib/catalog/index.ts uses the
 * same per-page rules. The tests next to this file check these counts against getListing().
 */
import snapshot from "@/content/catalog.json";

/** Products per page when the address has no (valid) ?per_page= (the live shop's setting). */
export const defaultPerPage = 21;

/** Reads ?per_page=…; any positive whole number works on the live site (?per_page=100 shows 100). */
export function normalisePerPage(value: string | null | undefined): number {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : defaultPerPage;
}

/** How many pages a listing of `count` products has (at least one, even when empty). */
export function lastPage(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / perPage));
}

type IndexCategory = { id: number; parent: number; slug: string };
type IndexProduct = { path: string; categories: string[] };

/** What the proxy needs to know about the shop's addresses. */
export type ShopIndex = {
  /** Every product address, e.g. "/product/bpc-157/". */
  productPaths: ReadonlySet<string>;
  /** All products: the shop's listing. */
  shopProductCount: number;
  /** Category slug → number of products in its listing (sub-categories included). */
  categoryProductCounts: ReadonlyMap<string, number>;
  /** A product's earlier address → its address now (its slug was changed in /admin/products/): 301. */
  movedProducts: ReadonlyMap<string, string>;
};

/** A category and all its sub-categories (as getListing counts them). */
function familySlugs(category: IndexCategory, categories: IndexCategory[]): Set<string> {
  const family = new Set([category.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (!family.has(c.id) && family.has(c.parent)) {
        family.add(c.id);
        grew = true;
      }
    }
  }
  return new Set(categories.filter((c) => family.has(c.id)).map((c) => c.slug));
}

/**
 * A product's earlier addresses (its old slugs) → its address now. An earlier address that is a product's
 * address today stays that product's, as on WordPress (its old-slug redirect only answers a missing address).
 */
export function movedProductsOf(products: { slug: string; oldSlugs: readonly string[] }[], productPaths: ReadonlySet<string>): Map<string, string> {
  const moved = new Map<string, string>();
  for (const product of products) {
    const path = `/product/${product.slug}/`;
    if (!productPaths.has(path)) continue;
    for (const old of product.oldSlugs) {
      const from = `/product/${old}/`.toLowerCase();
      if (!productPaths.has(from) && !moved.has(from)) moved.set(from, path);
    }
  }
  return moved;
}

/** The index of a list of products (the snapshot's, or the store database's: /api/catalog/index/). */
export function shopIndexOf(products: IndexProduct[], categories: IndexCategory[], movedProducts: ReadonlyMap<string, string> = new Map()): ShopIndex {
  return {
    movedProducts,
    productPaths: new Set(products.map((p) => p.path)),
    shopProductCount: products.length,
    categoryProductCounts: new Map(
      categories.map((category) => {
        const slugs = familySlugs(category, categories);
        return [category.slug, products.filter((p) => p.categories.some((slug) => slugs.has(slug))).length];
      }),
    ),
  };
}

/** The snapshot's index: used when the store database's can't be fetched (and in tests). */
export const snapshotIndex = shopIndexOf(snapshot.products as IndexProduct[], snapshot.categories as IndexCategory[]);

export const productPaths = snapshotIndex.productPaths;
export const shopProductCount = snapshotIndex.shopProductCount;
export const categoryProductCounts = snapshotIndex.categoryProductCounts;

let cached: { at: number; index: ShopIndex } | null = null;

/**
 * The current index (products added, renamed or archived in /admin/products/ included), from
 * /api/catalog/index/ on this site, kept 30 seconds per server instance; the snapshot's if that fails.
 * `fresh`: read it again unless it is under 2 seconds old (a product address it doesn't know may be a
 * product added a moment ago).
 */
export async function currentShopIndex(origin: string, fresh = false): Promise<ShopIndex> {
  if (process.env.CATALOG_SOURCE === "snapshot") return snapshotIndex;
  if (cached && Date.now() - cached.at < (fresh ? 2_000 : 30_000)) return cached.index;
  try {
    const response = await fetch(`${origin}/api/catalog/index/`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { productPaths: string[]; shopProductCount: number; categoryProductCounts: [string, number][]; movedProducts?: [string, string][] };
    const index: ShopIndex = {
      productPaths: new Set(data.productPaths),
      shopProductCount: data.shopProductCount,
      categoryProductCounts: new Map(data.categoryProductCounts),
      movedProducts: new Map(data.movedProducts ?? []),
    };
    cached = { at: Date.now(), index };
    return index;
  } catch {
    return cached?.index ?? snapshotIndex;
  }
}
