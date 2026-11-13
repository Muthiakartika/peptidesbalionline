/**
 * GET /api/catalog/index/ : which product addresses exist, how many products each listing has, and the
 * products' earlier addresses (slug changed in /admin/products/), for src/proxy.ts: it answers unknown shop
 * addresses with a real 404 and a product's old address with a 301 to its new one. Products come from the
 * store database, so a product added, renamed or archived there is known within seconds.
 */
import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { productRecords } from "@/db/schema";
import { movedProductsOf, shopIndexOf } from "@/lib/catalog/archive-index";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { catalogFromDb } from "@/lib/catalog/store";

/** The products' old slugs (none when the shop reads the snapshot, or the database can't be read). */
async function oldSlugRows(): Promise<{ slug: string; oldSlugs: string[] }[]> {
  if (!catalogFromDb) return [];
  try {
    return await getDb().select({ slug: productRecords.slug, oldSlugs: productRecords.oldSlugs }).from(productRecords).orderBy(asc(productRecords.createdAt));
  } catch {
    return [];
  }
}

export async function GET() {
  const products = await getAllProducts();
  const productPaths = new Set(products.map((p) => p.path));
  const index = shopIndexOf(products, await getCategories(), movedProductsOf(await oldSlugRows(), productPaths));
  return Response.json({
    productPaths: [...index.productPaths],
    shopProductCount: index.shopProductCount,
    categoryProductCounts: [...index.categoryProductCounts],
    movedProducts: [...index.movedProducts],
  });
}
