/**
 * A product page's structured data (src/lib/seo/product-jsonld.ts + src/components/seo/JsonLd.tsx): offers
 * from the current prices without unpriced variations (Q-17), the copied name kept unless the product was
 * renamed, and WooCommerce's Product block for a product the live snapshot doesn't have.
 */
import { describe, expect, it } from "vitest";

import { withCurrentProduct } from "@/components/seo/JsonLd";
import type { ProductPageData } from "@/lib/catalog/product-page";
import type { Product } from "@/lib/catalog/types";

import { productJsonLd } from "./product-jsonld";

const rp = (rupiah: number) => BigInt(rupiah) * 100n;
const now = new Date("2026-11-13T05:00:00Z");
const variation = (id: number, rupiah: number) => ({ id, attributes: {}, price: rp(rupiah), inStock: true, image: null });
const product = (extra: Partial<Product>) =>
  ({ id: 100, path: "/product/tb-500-5mg/", name: "TB-500", type: "variable", priceMin: 0n, priceMax: rp(950_000), inStock: true, variations: [], ...extra }) as unknown as Product;
const page = { gallery: [{ full: { src: "https://peptidesbali.online/wp-content/uploads/tb.webp", width: 600, height: 600 } }], shortDescription: "<p>TB-500 &amp; more</p>" } as unknown as ProductPageData;

describe("a product's structured data", () => {
  it("leaves a variation without a price out of the offer, as WooCommerce (TB-500 on live)", () => {
    const data = productJsonLd(product({ variations: [variation(1, 0), variation(2, 850_000), variation(3, 950_000)] }), page, {}, now);
    expect(data.offer).toMatchObject({ "@type": "AggregateOffer", lowPrice: "850000.00", highPrice: "950000.00", offerCount: 2 });
    // Only unpriced variations besides one price: a single Offer (CJC-1295 DAC 5mg on live).
    const one = productJsonLd(product({ variations: [variation(1, 0), variation(2, 1_900_000)] }), page, {}, now);
    expect(one.offer).toMatchObject({ "@type": "Offer", price: "1900000.00" });
  });

  it("reads a backorder as BackOrder", () => {
    const data = productJsonLd(product({ type: "simple", priceMin: rp(100_000), variations: [] }), page, { "100": { notify: true } }, now);
    expect(data.offer).toMatchObject({ availability: "https://schema.org/BackOrder" });
  });

  it("keeps the name as live writes it, and takes a new name after a rename", () => {
    const copied = { "@type": "Product", name: "Insulin Pen Needle - 31G - 100 PCS", offers: [{ old: true }] };
    const same = withCurrentProduct(copied, { name: "Insulin Pen Needle – 31G – 100 PCS", offer: { "@type": "Offer" }, block: {} }) as Record<string, unknown>;
    expect(same.name).toBe("Insulin Pen Needle - 31G - 100 PCS");
    expect(same.offers).toEqual([{ "@type": "Offer" }]);
    expect(Object.keys(same)).toEqual(["@type", "name", "offers"]);
    const renamed = withCurrentProduct(copied, { name: "Pen Needles 31G", offer: null, block: {} }) as Record<string, unknown>;
    expect(renamed).toEqual({ "@type": "Product", name: "Pen Needles 31G" });
    // Other blocks (FAQ, Yoast's graph) are left as they are.
    expect(withCurrentProduct({ "@type": "FAQPage" }, { name: "x", offer: null, block: {} })).toEqual({ "@type": "FAQPage" });
  });

  it("builds WooCommerce's Product block for a product made in the admin", () => {
    const data = productJsonLd(product({ path: "/product/new-one/", name: "New One", type: "simple", priceMin: rp(500_000), variations: [] }), page, {}, now);
    expect(data.block).toMatchObject({
      "@context": "https://schema.org/",
      "@type": "Product",
      "@id": "https://peptidesbali.online/product/new-one/#product",
      name: "New One",
      url: "https://peptidesbali.online/product/new-one/",
      description: "TB-500 & more",
      image: "https://peptidesbali.online/wp-content/uploads/tb.webp",
      sku: "100",
      offers: [expect.objectContaining({ "@type": "Offer", price: "500000.00" })],
    });
  });
});
