/**
 * Where the shop's catalogue comes from: the store database (edited in /admin/products/,
 * /admin/categories/ and /admin/attributes/) combined with the snapshot of the live shop (./build.ts).
 * The database rows are cached ("use cache", tags "catalog" and "sanity") until the admin saves
 * something (updateTag("catalog")) or Sanity publishes (its pictures). Falls back to the snapshot alone when the database has no products or can't be reached,
 * and always in tests (CATALOG_SOURCE=snapshot, vitest.config.mts).
 */
import "server-only";

import { createHash } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { inventory, productAttributes, productCategories, productRecords, productVariants } from "@/db/schema";
import { contentFromSanity, getSanityProductMedia, SANITY_TAG } from "@/lib/content/sanity";
import { withMediaUrls } from "@/lib/media/url";

import { buildCatalog, type BuiltCatalog, type DbProductRow, type ProductMedia, type Taxonomy } from "./build";
import { snapshotCategories, snapshotPages, snapshotProducts, snapshotShopCarousel } from "./snapshot";

export const CATALOG_TAG = "catalog";

/** False in tests: the catalogue is the snapshot. */
export const catalogFromDb = process.env.CATALOG_SOURCE !== "snapshot";

/** Every product with its variants and stock, as ./build.ts takes them. */
export async function loadCatalogRows(): Promise<DbProductRow[]> {
  const db = getDb();
  const records = await db.select().from(productRecords).orderBy(asc(productRecords.menuOrder));
  const variants = await db
    .select({ variant: productVariants, stock: inventory })
    .from(productVariants)
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .orderBy(asc(productVariants.sortOrder));
  const byProduct = new Map<string, DbProductRow["variants"]>();
  for (const { variant, stock } of variants) {
    const list = byProduct.get(variant.productId) ?? [];
    list.push({
      shopId: variant.shopId,
      variantKey: variant.variantKey,
      attributes: variant.attributes,
      image: variant.image ?? null,
      regularPriceMinor: variant.regularPriceMinor,
      salePriceMinor: variant.salePriceMinor,
      saleFrom: variant.saleFrom,
      saleTo: variant.saleTo,
      status: variant.status,
      sortOrder: variant.sortOrder,
      manageStock: stock?.manageStock ?? false,
      stockQuantity: stock?.stockQuantity ?? null,
      stockStatus: stock?.stockStatus ?? "instock",
      backorders: stock?.backorders ?? "no",
    });
    byProduct.set(variant.productId, list);
  }
  return records.map((r) => ({
    shopId: r.shopId,
    sanityId: r.sanityId,
    slug: r.slug,
    name: r.name,
    type: r.type,
    status: r.status,
    categorySlugs: r.categorySlugs,
    menuOrder: r.menuOrder,
    publishedAt: r.publishedAt,
    attributes: r.attributes,
    variants: byProduct.get(r.id) ?? [],
  }));
}

/** The categories and shop-wide attributes (/admin/categories/, /admin/attributes/); their pictures
 * on this site's media address (R2) like the snapshot's. */
export async function loadTaxonomyRows(): Promise<Taxonomy> {
  const db = getDb();
  const [categories, attributes] = await Promise.all([db.select().from(productCategories).orderBy(asc(productCategories.id)), db.select().from(productAttributes).orderBy(asc(productAttributes.slug))]);
  return {
    categories: withMediaUrls(categories.map(({ id, slug, name, parentId, title, sortOrder, tileImage, searchImage, seo }) => ({ id, slug, name, parentId, title, sortOrder, tileImage, searchImage, seo }))),
    attributes: attributes.map(({ slug, label, swatches, terms }) => ({ slug, label, swatches, terms })),
  };
}

type CatalogSource = { version: string; rows: DbProductRow[]; taxonomy: Taxonomy; media: ProductMedia; /** When it was read (ms): the time sale dates are checked against. */ readAt: number };

/**
 * What the database (and Sanity's pictures) hold, small enough to cache (about 200 KB). The catalogue
 * itself (with every product page, about 11 MB) is NOT cached: caching it made each page of the build
 * read it back whole, and the build ran out of memory (9 Nov 2026). It is assembled once per server
 * process and version instead (getBuiltCatalog).
 */
async function getCatalogSource(): Promise<CatalogSource | null> {
  "use cache";
  cacheTag(CATALOG_TAG, SANITY_TAG);
  cacheLife("hours");
  let rows: DbProductRow[];
  let taxonomy: Taxonomy;
  try {
    [rows, taxonomy] = await Promise.all([loadCatalogRows(), loadTaxonomyRows()]);
  } catch (error) {
    console.error("Catalogue: the store database can't be read, showing the snapshot.", error instanceof Error ? error.message : error);
    return null;
  }
  if (!rows.length) return null;
  const media: ProductMedia = contentFromSanity ? await getSanityProductMedia().catch(() => ({})) : {};
  const version = createHash("sha1")
    .update(JSON.stringify({ rows, taxonomy, media }, (_key, value) => (typeof value === "bigint" ? value.toString() : value)))
    .digest("hex");
  // Read inside the cache: Next.js doesn't allow the current time in a page outside it. The cache
  // lives an hour at most ("hours"), so a sale that starts or ends on a date shows within the hour.
  return { version, rows, taxonomy, media, readAt: Date.now() };
}

let assembled: { key: string; catalog: BuiltCatalog } | null = null;

/** The catalogue from the database, or null (no products there, or the database can't be reached). */
export async function getBuiltCatalog(): Promise<BuiltCatalog | null> {
  const source = await getCatalogSource();
  if (!source) return null;
  // Rebuilt when the data changes or the cached rows were read again (at least hourly).
  const key = `${source.version}:${source.readAt}`;
  if (assembled?.key !== key) {
    assembled = {
      key,
      catalog: buildCatalog({ products: snapshotProducts, pages: snapshotPages, categories: snapshotCategories, shopCarousel: snapshotShopCarousel() }, source.rows, source.media, new Date(source.readAt), source.taxonomy),
    };
  }
  return assembled.catalog;
}
