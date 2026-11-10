/**
 * The snapshot of the live shop (src/content/catalog.json and product-pages.json, made by
 * scripts/audit/export_shop_snapshot.py and export_product_pages.py), typed. It is the shop when the
 * store database has no products (tests, a fresh computer), and the source of what the database
 * doesn't hold (pictures, card and page layout data, SEO tags) when it has: ./build.ts.
 */
import "server-only";

import rawSnapshot from "@/content/catalog.json";
import rawPages from "@/content/product-pages.json";
import { withMediaUrls } from "@/lib/media/url";

import type { ProductPageData } from "./product-page";
import type { Category, CategoryTile, PageSeo, Product } from "./types";

type RawImage = { src: string; width: number; height: number; alt: string; srcset?: string; sizes?: string };
type RawSnapshot = {
  generatedAt: string;
  shopSeo: PageSeo;
  shopCarousel: { path: string; image: RawImage }[];
  categories: (Omit<Category, "carousel"> & { image: string | null; carousel: { path: string; image: RawImage }[] })[];
  products: (Omit<Product, "priceMin" | "priceMax" | "variations" | "cardCategories"> & {
    priceMin: number;
    priceMax: number;
    cardCategories: string[];
    variations: (Omit<Product["variations"][number], "price"> & { price: number })[];
  })[];
};
type RawPages = { generatedAt: string; blocks: Record<string, string>; stylesheets: number[]; pages: Record<string, ProductPageData> };

const snapshot = withMediaUrls(rawSnapshot as unknown as RawSnapshot);
const pagesFile = withMediaUrls(rawPages as unknown as RawPages);

const categoryByPath = new Map(snapshot.categories.map((c) => [c.path, c]));

function tile(entry: { path: string; image: RawImage }): CategoryTile {
  const category = categoryByPath.get(entry.path);
  return { path: entry.path, name: category?.name ?? entry.path, image: entry.image };
}

/** When the snapshot was taken (shown nowhere, useful when debugging). */
export const snapshotGeneratedAt = snapshot.generatedAt;

export const snapshotShopSeo: PageSeo = snapshot.shopSeo;

export const snapshotShopCarousel = (): CategoryTile[] => snapshot.shopCarousel.map(tile);

export const snapshotCategories: Category[] = snapshot.categories.map((c) => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  parent: c.parent,
  count: c.count,
  path: c.path,
  title: c.title,
  seo: c.seo,
  searchImage: c.searchImage ?? null,
  carousel: c.carousel.map(tile),
}));

export const snapshotProducts: Product[] = snapshot.products.map((p) => ({
  ...p,
  searchImage: p.searchImage ?? null,
  priceMin: BigInt(p.priceMin),
  priceMax: BigInt(p.priceMax),
  cardCategories: p.cardCategories.map((path) => ({ path, name: categoryByPath.get(path)?.name ?? path })),
  variations: p.variations.map((v) => ({ ...v, price: BigInt(v.price) })),
}));

/** The product pages, in the shop's order (each has its product's `id`). */
export const snapshotPages: ProductPageData[] = snapshotProducts.map((p) => pagesFile.pages[p.path]).filter(Boolean);

/** Elementor block HTML shared by many products (e.g. #701, the buttons under "Add to cart"). */
export const snapshotBlocks: Record<string, string> = pagesFile.blocks;

/** Products and variations on backorder on live (src/content/stock-status.json). */
export { default as snapshotStockStatus } from "@/content/stock-status.json";
