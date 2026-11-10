/**
 * GET /api/catalog/index/ : which product addresses exist and how many products each listing has,
 * for src/proxy.ts (it answers unknown shop addresses with a real 404). Products come from the store
 * database (/admin/products/), so a product added or archived there is known within seconds.
 */
import { shopIndexOf } from "@/lib/catalog/archive-index";
import { getAllProducts, getCategories } from "@/lib/catalog";

export async function GET() {
  const index = shopIndexOf(await getAllProducts(), await getCategories());
  return Response.json({ productPaths: [...index.productPaths], shopProductCount: index.shopProductCount, categoryProductCounts: [...index.categoryProductCounts] });
}
