/**
 * GET /api/quick-view/?id=4704 : what the "Quick view" popup of a product card shows (the live
 * site loads the same thing with Woodmart's AJAX quick view): pictures, title, price, the included
 * supplies note, the option form, SKU and categories.
 */
import type { NextRequest } from "next/server";

import type { QuickViewResponse } from "@/components/product/quick-view-types";
import { backorderFor, getCatalogState, getProductById } from "@/lib/catalog";
import { withProductContent } from "@/lib/catalog/product-content";
import { getProductPage } from "@/lib/catalog/product-page";
import { cleanLegacyHtml } from "@/lib/legacy-html";

export async function GET(request: NextRequest) {
  const product = await getProductById(Number(request.nextUrl.searchParams.get("id")));
  const page = product ? await withProductContent(await getProductPage(product.path), product.path) : undefined;
  if (!product || !page) return Response.json({ error: "Unknown product" }, { status: 404 });

  const body: QuickViewResponse = {
    id: product.id,
    title: page.title,
    path: product.path,
    gallery: page.gallery,
    includedSupplies: page.includedSupplies ? cleanLegacyHtml(page.includedSupplies) : null,
    form: page.form,
    sku: page.meta?.sku ?? null,
    categories: page.meta?.categories ?? [],
    priceMin: product.priceMin.toString(),
    priceMax: product.priceMax.toString(),
    ...(product.regularPrice !== undefined ? { regularPrice: product.regularPrice.toString() } : {}),
    variations: product.variations.map((v) => ({ id: v.id, attributes: v.attributes, price: v.price.toString(), inStock: v.inStock, ...(v.regularPrice !== undefined ? { regularPrice: v.regularPrice.toString() } : {}) })),
    backorder: backorderFor(product, (await getCatalogState()).backorder),
  };
  return Response.json(body);
}
