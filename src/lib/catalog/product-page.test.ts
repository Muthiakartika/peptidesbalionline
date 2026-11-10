/**
 * Checks the product-page snapshot (src/content/product-pages.json, made by
 * scripts/audit/export_product_pages.py) and the quick-view answer built from it.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as quickView } from "@/app/api/quick-view/route";
import type { QuickViewResponse } from "@/components/product/quick-view-types";

import { getAllProducts } from "./index";
import { getProductPage } from "./product-page";

const products = await getAllProducts();
const pageOf = new Map(await Promise.all(products.map(async (p) => [p.path, await getProductPage(p.path)] as const)));

describe("product pages snapshot", () => {

  it("has a page for every product of the shop", () => {
    for (const product of products) expect(pageOf.get(product.path), product.path).toBeDefined();
  });

  it("keeps real picture files (not the lazy-loader's placeholders) and the zoom file", () => {
    for (const product of products) {
      const page = pageOf.get(product.path)!;
      expect(page.gallery.length, product.path).toBeGreaterThan(0);
      for (const image of page.gallery) {
        expect(image.src, product.path).toMatch(/^https:\/\/peptidesbali\.online\/wp-content\/uploads\//);
        expect(image.full.src, product.path).toMatch(/^https:\/\/peptidesbali\.online\/wp-content\/uploads\//);
      }
    }
  });

  it("knows the gallery picture of each variation it lists, for variations of that product only", () => {
    for (const product of products) {
      const page = pageOf.get(product.path)!;
      if (page.form.type !== "variable") continue;
      const ids = new Set(product.variations.map((v) => String(v.id)));
      for (const id of Object.keys(page.form.images)) expect(ids.has(id), `${product.path} variation ${id}`).toBe(true);
      for (const attribute of page.form.attributes) {
        for (const option of attribute.options) {
          const exists = product.variations.some((v) => !v.attributes[attribute.name] || v.attributes[attribute.name] === option.value);
          expect(exists, `${product.path} ${attribute.name}=${option.value}`).toBe(true);
        }
      }
    }
  });

  it("lists categories A–Z for the quick view", () => {
    for (const product of products) {
      const names = pageOf.get(product.path)!.meta.categories.map((c) => c.name.toLowerCase());
      expect(names.length, product.path).toBeGreaterThan(0);
      expect(names, product.path).toEqual([...names].sort());
    }
  });
});

describe("GET /api/quick-view/", () => {
  it("answers like the live quick view of GLP-3 RTA Pen (recorded 4 Nov 2026)", async () => {
    const response = await quickView(new NextRequest("http://localhost/api/quick-view/?id=4704"));
    expect(response.status).toBe(200);
    const body: QuickViewResponse = await response.json();
    expect(body.title).toBe("GLP-3 RTA Pen");
    expect(body.path).toBe("/product/glp-3-10mg-pen/");
    expect(body.sku).toBeNull(); // the popup prints "SKU: N/A"
    expect(body.categories.map((c) => c.name)).toEqual(["Atlas Longevity", "Peptide Pens"]);
    expect(body.gallery).toHaveLength(4);
    expect(body.priceMin).toBe("250000000");
  });

  it("answers 404 for an unknown product", async () => {
    expect((await quickView(new NextRequest("http://localhost/api/quick-view/?id=1"))).status).toBe(404);
  });
});
