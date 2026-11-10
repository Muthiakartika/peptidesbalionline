/** When the shop strikes a regular price through (WooCommerce's wc_format_sale_price / get_price_html). */
import { describe, expect, it } from "vitest";

import { productFromJson, productToJson } from "./product-json";
import { struckRegular } from "./sale";
import { snapshotProducts } from "./snapshot";

describe("sale prices", () => {
  it("strikes through a single price with a higher regular price, never a range", () => {
    expect(struckRegular(150n, 150n, 200n)).toBe(200n);
    expect(struckRegular(150n, 150n, "200")).toBe(200n);
    expect(struckRegular(150n, 150n, 150n)).toBeNull();
    expect(struckRegular(150n, 150n, undefined)).toBeNull();
    expect(struckRegular(100n, 150n, 200n)).toBeNull();
  });

  it("carries the regular prices through JSON (the browser's product cards)", () => {
    const product = { ...snapshotProducts.find((p) => p.type === "variable")! };
    product.regularPrice = 999_00n;
    product.variations = product.variations.map((v, i) => (i === 0 ? { ...v, onSale: true, regularPrice: 1_234_00n } : v));
    const json = productToJson(product);
    expect(json.regularPrice).toBe("99900");
    expect(json.variations[0].regularPrice).toBe("123400");
    expect(productFromJson(JSON.parse(JSON.stringify(json)))).toEqual(product);
  });
});
