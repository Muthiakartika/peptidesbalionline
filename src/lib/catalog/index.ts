/**
 * Catalogue data for the shop pages: products, categories, sorting, paging and search.
 *
 * Products: the store database (prices, stock, status, names, categories: /admin/products/) over the
 * snapshot of the live site (src/content/catalog.json: pictures and card data), see ./store.ts.
 * Categories: the store database too (/admin/categories/). The lookups are async because of that.
 *
 * All rules here were checked against the live WooCommerce shop (see the tests next to this file).
 */
import "server-only";

import type { ProductPageData } from "./product-page";
import { defaultPerPage, normalisePerPage } from "./archive-index";
import { familySlugs } from "./build";
import { matchesTitleSearch, parseSearchTerms } from "./search";
import { snapshotCategories, snapshotGeneratedAt, snapshotPages, snapshotProducts, snapshotShopCarousel, snapshotShopSeo, snapshotStockStatus } from "./snapshot";
import { catalogFromDb, getBuiltCatalog } from "./store";
import type { Category, CategoryTile, PageSeo, Product, SortKey } from "./types";

export type { Category, CategoryTile, PageSeo, Product, SortKey, Variation } from "./types";

// ---------------------------------------------------------------------------------------------
// Where the products and categories come from: the store database (edited in /admin/products/ and
// /admin/categories/) over the snapshot (./store.ts, ./build.ts); the snapshot alone when the database
// has no products, and in tests.
// ---------------------------------------------------------------------------------------------

/** When the snapshot was taken (shown nowhere, useful when debugging). */
export const catalogGeneratedAt = snapshotGeneratedAt;

export type CatalogState = {
  products: Product[];
  byPath: Map<string, Product>;
  byId: Map<number, Product>;
  pages: Map<number, ProductPageData>;
  /** Products and variations on backorder, by shop number. */
  backorder: Record<string, { notify: boolean }>;
  /** Every category, by name, with its product count. */
  categories: Category[];
  /** The round pictures on /shop/ (the top-level categories in their order). */
  shopCarousel: CategoryTile[];
};

function makeState(
  products: Product[],
  pages: ProductPageData[],
  backorder: Record<string, { notify: boolean }>,
  categories: Category[],
  shopCarousel: CategoryTile[],
): CatalogState {
  const sorted = [...products].sort((a, b) => a.ranks.menu_order - b.ranks.menu_order);
  return {
    products: sorted,
    byPath: new Map(sorted.map((p) => [p.path, p])),
    byId: new Map(sorted.map((p) => [p.id, p])),
    pages: new Map(pages.map((p) => [p.id, p])),
    backorder,
    categories,
    shopCarousel,
  };
}

const snapshotState = makeState(
  snapshotProducts,
  snapshotPages,
  (snapshotStockStatus as { backorder: Record<string, { notify: boolean }> }).backorder,
  snapshotCategories,
  snapshotShopCarousel(),
);

/** One product's backorder entries (the product and its variations), for the add-to-cart form. */
export function backorderFor(product: Product, backorder: CatalogState["backorder"]): Record<string, { notify: boolean }> {
  return Object.fromEntries([product.id, ...product.variations.map((v) => v.id)].filter((id) => backorder[String(id)]).map((id) => [String(id), backorder[String(id)]]));
}

/** The current catalogue (products, product pages, backorders). */
const states = new WeakMap<object, CatalogState>();

export async function getCatalogState(): Promise<CatalogState> {
  if (!catalogFromDb) return snapshotState;
  const built = await getBuiltCatalog();
  if (!built) return snapshotState;
  let state = states.get(built);
  if (!state) {
    state = makeState(built.products, built.pages, built.backorder, built.categories, built.shopCarousel);
    states.set(built, state);
  }
  return state;
}

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

/** Every category, by name (as WordPress lists them), with how many products each lists. */
export async function getCategories(): Promise<Category[]> {
  return (await getCatalogState()).categories;
}

/** Yoast tags of /shop/ (its paginated pages /shop/page/N/ use the same title and description). */
export function getShopSeo(): PageSeo {
  return snapshotShopSeo;
}

/** The round images on /shop/ and the search page: the top-level categories, in the owner's order. */
export async function getShopCarousel(): Promise<CategoryTile[]> {
  return (await getCatalogState()).shopCarousel;
}

/**
 * Finds a category from the URL segments after /product-category/.
 * Like WordPress, only the LAST segment decides: /product-category/healing-recovery/ shows the same
 * category as /product-category/vial/healing-recovery/ (the page's canonical tag points to the real path).
 */
export async function getCategoryBySegments(segments: string[]): Promise<Category | undefined> {
  const slug = segments.at(-1);
  return (await getCategories()).find((c) => c.slug === slug);
}

/** True when the product is in one of these categories or their sub-categories (WordPress rule). */
export function isInCategories(product: Product, categoryIds: number[], categories: Category[]): boolean {
  const slugs = new Set<string>();
  for (const id of categoryIds) {
    const category = categories.find((c) => c.id === id);
    if (category) familySlugs(category, categories).forEach((slug) => slugs.add(slug));
  }
  return product.categories.some((slug) => slugs.has(slug));
}

/** Parents first: [Peptide Vials, Healing & Recovery] for /product-category/vial/healing-recovery/. */
export async function getCategoryTrail(category: Category): Promise<Category[]> {
  const categories = await getCategories();
  const trail = [category];
  const seen = new Set([category.id]);
  let parent = categories.find((c) => c.id === category.parent);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    trail.unshift(parent);
    const above = parent.parent;
    parent = categories.find((c) => c.id === above);
  }
  return trail;
}

export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

/** The "Product categories" sidebar: every level sorted by name, like the WooCommerce widget. */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const categories = await getCategories();
  const build = (parent: number): CategoryTreeNode[] =>
    categories
      .filter((c) => c.parent === parent && c.id !== parent)
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .map((c) => ({ ...c, children: build(c.id) }));
  return build(0);
}

// ---------------------------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------------------------

export async function getProductByPath(path: string): Promise<Product | undefined> {
  return (await getCatalogState()).byPath.get(path);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return (await getCatalogState()).byId.get(id);
}

/** Every product on sale, in the shop's default order. */
export async function getAllProducts(): Promise<Product[]> {
  return (await getCatalogState()).products;
}

/** Sort options of the shop toolbar. The labels are the live site's (its "popularity" is the custom order). */
export const sortOptions: { value: SortKey | "relevance"; label: string }[] = [
  { value: "menu_order", label: "Sort by popularity" },
  { value: "date", label: "Sort by latest" },
  { value: "price", label: "Sort by price: low to high" },
  { value: "price-desc", label: "Sort by price: high to low" },
  { value: "title", label: "Sort by A–Z" },
];

// The per-page rules live in archive-index.ts, which src/proxy.ts also reads.
export { defaultPerPage, normalisePerPage };
export const perPageChoices = [9, 12, 18, 24];

export type ListingQuery = {
  category?: Category;
  search?: string;
  orderby?: string;
  page?: number;
  perPage?: number;
};

export type Listing = {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  /** 1-based position of the first and last product on this page (for "Showing 1–21 of 182 results"). */
  first: number;
  last: number;
  /** The sort that was applied ("relevance" on search pages unless another one was chosen). */
  orderby: SortKey | "relevance";
};

/** Reads ?orderby=…; unknown values fall back to the default, like WooCommerce. */
export function normaliseOrderby(value: string | undefined, isSearch: boolean): SortKey | "relevance" {
  const known = ["menu_order", "date", "price", "price-desc", "title"];
  if (value && known.includes(value)) return value as SortKey;
  return isSearch ? "relevance" : "menu_order";
}

/** One page of a shop, category or search listing. */
export async function getListing({ category, search, orderby, page = 1, perPage = defaultPerPage }: ListingQuery): Promise<Listing> {
  const isSearch = search !== undefined;
  const sort = normaliseOrderby(orderby, isSearch);
  const state = await getCatalogState();
  let items = state.products;
  if (category) {
    const slugs = familySlugs(category, state.categories);
    items = items.filter((p) => p.categories.some((slug) => slugs.has(slug)));
  }
  if (isSearch) {
    const terms = parseSearchTerms(search);
    items = items.filter((p) => matchesTitleSearch(p.name, terms));
  }
  // The live search results page lists matches in the shop's default order even though its
  // dropdown says "Relevance" (checked with 14 queries, src/lib/catalog/search-samples.json).
  const rankKey: SortKey = sort === "relevance" ? "menu_order" : sort;
  items = [...items].sort((a, b) => a.ranks[rankKey] - b.ranks[rankKey]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const pageItems = items.slice(start, start + perPage);
  return {
    products: pageItems,
    total,
    page,
    totalPages,
    first: total === 0 ? 0 : start + 1,
    last: start + pageItems.length,
    orderby: sort,
  };
}

/**
 * Search suggestions in the header search (Woodmart AJAX search on the live site):
 * matching categories first (name or slug, A–Z), then up to 20 products, newest first.
 * Shown from 3 typed characters.
 */
export async function getSearchSuggestions(query: string): Promise<{ categories: Category[]; products: Product[] }> {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return { categories: [], products: [] };
  const needle = query.trim().toLowerCase();
  const matchedCategories = (await getCategories())
    .filter((c) => c.name.toLowerCase().includes(needle) || c.slug.includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const matchedProducts = (await getCatalogState()).products
    .filter((p) => matchesTitleSearch(p.name, terms))
    // WordPress orders by publish date; products published in the same second come lowest id first.
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? 1 : -1))
    .slice(0, 20);
  return { categories: matchedCategories, products: matchedProducts };
}

// The "~$" price hint is also needed in the browser (product cards), so it lives in its own file.
export { formatUsd, usdRate } from "./usd";
