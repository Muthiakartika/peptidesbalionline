/**
 * The product and product-category sitemaps for the shop as it is now (src/lib/seo/sitemaps.ts explains the
 * rules). Cached with the catalogue: a change in /admin/products/ or /admin/categories/ refreshes them with
 * it (CATALOG_TAG), otherwise they are rebuilt at most once an hour.
 */
import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { getAllProducts, getCategories } from "@/lib/catalog";
import { CATALOG_TAG } from "@/lib/catalog/store";
import { siteUrl } from "@/lib/site";

import { productCategorySitemapEntries, productSitemapEntries, type SitemapEntry, type SitemapProduct } from "./sitemaps";

export async function shopSitemaps(): Promise<{ product: SitemapEntry[]; product_cat: SitemapEntry[] }> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const products: SitemapProduct[] = (await getAllProducts()).map((product) => {
    const src = product.image?.src ?? null;
    return { path: product.path, date: product.date, image: src && src.startsWith("/") ? `${siteUrl}${src}` : src, categories: product.categories };
  });
  const product = productSitemapEntries(products);
  const categories = (await getCategories()).map(({ id, parent, slug, path, count }) => ({ id, parent, slug, path, count }));
  return { product, product_cat: productCategorySitemapEntries(categories, product, products) };
}
