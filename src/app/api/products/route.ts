/**
 * GET /api/products/?ids=991,4023&category=18 : product cards for the browser, in the order of
 * `ids` (unknown ids are skipped). `category` keeps only products of those categories (comma
 * separated, sub-categories included). Used by the homepage's "recently viewed" grid.
 */
import type { NextRequest } from "next/server";

import { getCategories, getProductById, isInCategories } from "@/lib/catalog";
import { productToJson } from "@/lib/catalog/product-json";
import type { Product } from "@/lib/catalog/types";

const numbers = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);

export async function GET(request: NextRequest) {
  const ids = numbers(request.nextUrl.searchParams.get("ids"));
  const categories = numbers(request.nextUrl.searchParams.get("category"));
  const all = await getCategories();
  const products = (await Promise.all(ids.map((id) => getProductById(id))))
    .filter((p): p is Product => Boolean(p))
    .filter((p) => categories.length === 0 || isInCategories(p, categories, all));
  return Response.json(products.map(productToJson));
}
