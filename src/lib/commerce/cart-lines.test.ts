/**
 * Cart contents → priced lines, with the live catalogue snapshot: prices from the server, WooCommerce's
 * add-to-cart checks and texts, out-of-stock lines kept but blocking, parent categories included.
 */
import { describe, expect, it } from "vitest";

import { getAllProducts, getCategories, getProductById } from "@/lib/catalog";

import { checkAddToCart, priceCart } from "./cart-lines";
import { computeTotals } from "./totals";

const products = await getAllProducts();
const simple = products.find((p) => p.type === "simple" && p.inStock)!;
const variable = (await getProductById(4704))!; // GLP-3 RTA Pen: pen type × mg
const variation = variable.variations.find((v) => v.id === 9752)!; // disposable pen, 5mg
const outOfStock = products.find((p) => p.type === "simple" && !p.inStock);

describe("cart lines", () => {
  it("prices lines from the catalogue and labels the chosen options", async () => {
    const { lines, notices, errors } = await priceCart([
      { productId: simple.id, variationId: null, quantity: 2 },
      { productId: variable.id, variationId: variation.id, quantity: 1 },
    ]);
    expect(notices).toEqual([]);
    expect(errors).toEqual([]);
    expect(lines.map((l) => [l.name, l.unitPrice, l.quantity])).toEqual([
      [simple.name, simple.priceMin, 2],
      [variable.name, 280_000_000n, 1],
    ]);
    expect(lines[1].variantLabel).toMatch(/^.+: .+, .+: .+$/);
    // Totals on top of the lines: Rp 2,800,000 + 2 × the simple product, plus shipping.
    const totals = computeTotals({ lines });
    expect(totals.subtotal).toBe(simple.priceMin * 2n + 280_000_000n);
  });

  it("includes parent categories (WooCommerce counts them for coupons)", async () => {
    const categories = await getCategories();
    const parentSlugOf = (slug: string) => {
      const category = categories.find((c) => c.slug === slug);
      return categories.find((c) => c.id === category?.parent)?.slug;
    };
    // A product in a sub-category whose parent category isn't assigned to it directly.
    const child = products.find((p) => p.inStock && p.type === "simple" && p.categories.some((slug) => { const parent = parentSlugOf(slug); return parent && !p.categories.includes(parent); }))!;
    const { lines } = await priceCart([{ productId: child.id, variationId: null, quantity: 1 }]);
    const missingParents = child.categories.map(parentSlugOf).filter((slug): slug is string => !!slug && !child.categories.includes(slug));
    expect(lines[0].categories).toEqual(expect.arrayContaining([...child.categories, ...missingParents]));
  });

  it("merges the same product added twice, up to 9999", async () => {
    const { lines } = await priceCart([
      { productId: simple.id, variationId: null, quantity: 9000 },
      { productId: simple.id, variationId: null, quantity: 5000 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(9999);
  });

  it("removes products that can't be bought any more, keeps out-of-stock ones as a blocking error", async () => {
    const gone = await priceCart([{ productId: 999_999, variationId: null, quantity: 1 }]);
    expect(gone.lines).toEqual([]);
    expect(gone.notices).toEqual(["A product has been removed from your cart because it can no longer be purchased. Please contact us if you need assistance."]);
    const wrongVariation = await priceCart([{ productId: variable.id, variationId: 1, quantity: 1 }]);
    expect(wrongVariation.notices[0]).toContain(`${variable.name} has been removed from your cart`);
    if (outOfStock) {
      const stock = await priceCart([{ productId: outOfStock.id, variationId: null, quantity: 1 }]);
      expect(stock.lines[0].outOfStock).toBe(true);
      expect(stock.errors).toEqual([`Sorry, "${outOfStock.name}" is not in stock. Please edit your cart and try again. We apologize for any inconvenience caused.`]);
    }
  });

  it("checks 'Add to cart' with WooCommerce's texts", async () => {
    expect(await checkAddToCart(simple.id, null, 1)).toEqual({ ok: true, entry: { productId: simple.id, variationId: null, quantity: 1 } });
    expect(await checkAddToCart(variable.id, null, 1)).toEqual({ ok: false, error: "Please choose product options by visiting", link: { href: variable.path, text: variable.name } });
    expect(await checkAddToCart(variable.id, 1, 1)).toEqual({ ok: false, error: "Sorry, this product cannot be purchased." });
    expect(await checkAddToCart(999_999, null, 1)).toEqual({ ok: false, error: "Sorry, this product cannot be purchased." });
    expect((await checkAddToCart(simple.id, null, 0)).ok).toBe(false);
    if (outOfStock) expect(await checkAddToCart(outOfStock.id, null, 1)).toEqual({ ok: false, error: `You cannot add "${outOfStock.name}" to the cart because the product is out of stock.` });
  });
});
