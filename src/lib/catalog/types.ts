/**
 * The shapes of catalogue data used by the shop pages.
 *
 * Today the data comes from src/content/catalog.json, a snapshot of the live site made by
 * scripts/audit/export_shop_snapshot.py. In Phase 4 it comes from Sanity (texts, images) and
 * PostgreSQL (prices, stock). The pages only use these types, so they will not need to change.
 */

export type CatalogImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Same candidates as the live <img srcset>, so each screen loads the same file as on WordPress. */
  srcset?: string;
  sizes?: string;
};

/** One attribute in a product card's "quick shop" form, e.g. Pen Type (dropdown) or MG (pills). */
export type QuickShopAttribute = {
  /** Form field name, e.g. "attribute_pa_mg". Variations use the same keys. */
  name: string;
  label: string;
  /** true: shown as pill "swatches" (the dropdown is hidden). false: shown as a dropdown. */
  swatches: boolean;
  options: { value: string; label: string }[];
};

export type Variation = {
  id: number;
  /** e.g. { "attribute_pa_pen-type": "disposable-pen", "attribute_pa_mg": "10" }. "" means "any". */
  attributes: Record<string, string>;
  /** Minor units (IDR × 100). */
  price: bigint;
  inStock: boolean;
  image: { src: string; srcset: string | null; sizes: string | null; alt: string } | null;
  /** A sale price set in /admin/products/ is running: `price` is the sale price, this the regular one. */
  onSale?: boolean;
  regularPrice?: bigint;
};

export type SortKey = "menu_order" | "date" | "price" | "price-desc" | "title";

export type Product = {
  id: number;
  slug: string;
  /** URL path of the product page, e.g. "/product/bpc-157/". */
  path: string;
  name: string;
  type: "simple" | "variable";
  /** Publish date as WordPress stores it (site time zone), e.g. "2026-11-01T11:23:57". */
  date: string;
  /** Category slugs the product belongs to. */
  categories: string[];
  /** The category links printed on the card, in the live site's order. */
  cardCategories: { name: string; path: string }[];
  image: CatalogImage;
  /** Second image that fades in on hover (only some products have one). */
  hoverImage: CatalogImage | null;
  /** Square thumbnail shown in the header search suggestions. */
  searchImage: CatalogImage | null;
  /** Minor units. For variable products: the cheapest variation. */
  priceMin: bigint;
  priceMax: bigint;
  inStock: boolean;
  /** A sale set in /admin/products/ is running and the price shows struck through: priceMin is the sale
   * price, this the regular one (simple products; variable ones when all variations cost the same). */
  onSale?: boolean;
  regularPrice?: bigint;
  quickShop: QuickShopAttribute[];
  /**
   * The same attributes as `quickShop`, in the order the search-suggestion buy controls list them
   * (the owner's "Atlas search buy" snippet uses the attribute's term order, which can differ).
   */
  searchOptions: Omit<QuickShopAttribute, "swatches">[];
  variations: Variation[];
  /** Position of the product in each sort order of the live shop (0 = first). */
  ranks: Record<SortKey, number>;
};

export type Category = {
  id: number;
  slug: string;
  name: string;
  /** Parent category id, 0 for a top-level category. */
  parent: number;
  /** Number of products, including sub-categories (as WooCommerce counts them). */
  count: number;
  /** URL path, e.g. "/product-category/vial/healing-recovery/". */
  path: string;
  /** Heading of the category page (the live site shows the name). */
  title: string;
  /** Yoast tags of the category page on the live site. */
  seo: PageSeo;
  /** Thumbnail in the header search suggestions (null: the live site shows none). */
  searchImage: CatalogImage | null;
  /** Round images in the title band: the sub-categories, in the owner's order. */
  carousel: CategoryTile[];
};

export type CategoryTile = { path: string; name: string; image: CatalogImage };

/** The SEO tags copied from the live page (Yoast). They move to Sanity in Phase 4. */
export type PageSeo = {
  title: string;
  description: string | null;
  /** Yoast's robots meta, e.g. "index, follow, max-image-preview:large, …" or "noindex, follow"
   * (in every snapshot since 3b; optional for older ones). */
  robots?: string | null;
  ogType: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
};
