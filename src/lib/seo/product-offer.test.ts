/**
 * WooCommerce 11.2.1's product offers (src/lib/seo/product-offer.ts): the live NAD+ 500mg and BAC water
 * blocks rebuilt from prices and stock, sales, and the stock status of a variable product.
 */
import { describe, expect, it } from "vitest";

import { decimal, parentStatus, wooProductOffer } from "./product-offer";

const rp = (rupiah: number) => BigInt(rupiah) * 100n;
const now = new Date("2026-11-13T05:00:00Z");
const seller = { "@type": "Organization", name: "Atlas Longevity", url: "https://peptidesbali.online" };
const item = (rupiah: number, extra: Partial<Parameters<typeof wooProductOffer>[0]["items"][number]> = {}) => ({ price: rp(rupiah), regularPrice: rp(rupiah), onSale: false, status: "instock" as const, ...extra });

describe("WooCommerce's product offers", () => {
  it("writes prices with the shop's two decimals", () => {
    expect(decimal(rp(1_600_000))).toBe("1600000.00");
    expect(decimal(12_345n)).toBe("123.45");
  });

  it("a variable product: AggregateOffer with its lowest and highest price (live's NAD+ 500mg)", () => {
    expect(wooProductOffer({ type: "variable", url: "https://peptidesbali.online/product/nad-500mg/", items: [item(1_600_000), item(2_000_000)] }, now)).toEqual({
      "@type": "AggregateOffer",
      lowPrice: "1600000.00",
      highPrice: "2000000.00",
      offerCount: 2,
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
      url: "https://peptidesbali.online/product/nad-500mg/",
      seller,
      priceCurrency: "IDR",
    });
  });

  it("a simple product: Offer with its price (live's BAC water 3ml)", () => {
    expect(wooProductOffer({ type: "simple", url: "https://peptidesbali.online/product/bacteriostatic-water-3ml/", items: [item(100_000)] }, now)).toEqual({
      "@type": "Offer",
      priceSpecification: [{ "@type": "UnitPriceSpecification", price: "100000.00", priceCurrency: "IDR", validThrough: "2027-12-31" }],
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
      url: "https://peptidesbali.online/product/bacteriostatic-water-3ml/",
      seller,
      price: "100000.00",
      priceCurrency: "IDR",
    });
  });

  it("a sale: the sale price first, the regular one as ListPrice; until the sale's end when it has one", () => {
    const offer = wooProductOffer({ type: "simple", url: "u", items: [item(700_000, { regularPrice: rp(850_000), onSale: true, saleTo: "2026-12-01T00:00:00Z" })] }, now)!;
    expect(offer.priceSpecification).toEqual([
      { "@type": "UnitPriceSpecification", price: "700000.00", priceCurrency: "IDR", validThrough: "2026-12-01" },
      { "@type": "UnitPriceSpecification", priceType: "https://schema.org/ListPrice", price: "850000.00", priceCurrency: "IDR", validThrough: "2027-12-31" },
    ]);
    expect(offer.price).toBe("700000.00");
    expect(offer.priceValidUntil).toBe("2026-12-01");
    const variable = wooProductOffer({ type: "variable", url: "u", items: [item(900_000, { regularPrice: rp(1_000_000), onSale: true }), item(1_500_000)] }, now)!;
    expect(variable.priceSpecification).toEqual([{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/SalePrice", price: "900000.00", priceCurrency: "IDR", validThrough: "2027-12-31" }]);
  });

  it("every variation at the same price: one Offer", () => {
    const offer = wooProductOffer({ type: "variable", url: "u", items: [item(500_000), item(500_000)] }, now)!;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.price).toBe("500000.00");
  });

  it("stock: in stock when any variation is, else on backorder, else out of stock", () => {
    expect(parentStatus([item(1, { status: "outofstock" }), item(1, { status: "instock" })])).toBe("instock");
    expect(parentStatus([item(1, { status: "outofstock" }), item(1, { status: "onbackorder" })])).toBe("onbackorder");
    expect(parentStatus([item(1, { status: "outofstock" })])).toBe("outofstock");
    expect(wooProductOffer({ type: "simple", url: "u", items: [item(1, { status: "onbackorder" })] }, now)!.availability).toBe("https://schema.org/BackOrder");
    expect(wooProductOffer({ type: "variable", url: "u", items: [] }, now)).toBeNull();
  });
});
