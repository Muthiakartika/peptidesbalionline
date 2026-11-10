/**
 * GET /api/search-suggestions/?q=bpc : what the header search shows while typing (the live site's
 * Woodmart AJAX search + the owner's "search buy" lookup, in one answer).
 * Rules (title-only match, newest first, 20 products, categories A–Z): src/lib/catalog/index.ts.
 */
import type { NextRequest } from "next/server";

import { getSearchSuggestions } from "@/lib/catalog";
import type { SuggestionResponse } from "@/components/layout/search/suggestion-types";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const { categories, products } = await getSearchSuggestions(query);
  const body: SuggestionResponse = {
    query,
    categories: categories.map((c) => ({ name: c.name, path: c.path, image: c.searchImage })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      type: p.type,
      image: p.searchImage,
      // Money travels as strings (JSON has no bigint); the browser turns them back into bigint.
      priceMin: p.priceMin.toString(),
      priceMax: p.priceMax.toString(),
      ...(p.regularPrice !== undefined ? { regularPrice: p.regularPrice.toString() } : {}),
      options: p.searchOptions,
      // The live lookup only offers variations that can be bought.
      variations: p.variations.filter((v) => v.inStock).map((v) => ({ id: v.id, attributes: v.attributes, price: v.price.toString(), ...(v.regularPrice !== undefined ? { regularPrice: v.regularPrice.toString() } : {}) })),
    })),
  };
  return Response.json(body);
}
