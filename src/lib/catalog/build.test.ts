/**
 * The catalogue built from the rows the importer puts in the database (scripts/import/catalog-mapping.mjs)
 * must be the live shop's snapshot itself: same products, prices, stock, sort orders and product pages.
 * Then the admin's changes: archive, price, sale, stock, rename, a new product.
 */
import catalogJson from "@/content/catalog.json";
import productPagesJson from "@/content/product-pages.json";
import stockStatusJson from "@/content/stock-status.json";
import { describe, expect, it } from "vitest";

import { attributeRows, catalogRows, categoryRows } from "../../../scripts/import/catalog-mapping.mjs";
import { buildCatalog, type CatalogBase, type DbProductRow, type Taxonomy } from "./build";
import { snapshotCategories, snapshotPages, snapshotProducts, snapshotShopCarousel } from "./snapshot";

type Row = ReturnType<typeof catalogRows>[number];

const base = (): CatalogBase => ({ products: structuredClone(snapshotProducts), pages: structuredClone(snapshotPages), categories: snapshotCategories, shopCarousel: snapshotShopCarousel() });

function dbRows(rows: Row[] = catalogRows(catalogJson, productPagesJson, stockStatusJson)): DbProductRow[] {
  return rows.map(({ record, variants }) => ({
    ...record,
    type: record.type as "simple" | "variable",
    publishedAt: new Date(record.publishedAt),
    variants: variants.map((v: Row["variants"][number]) => ({
      shopId: v.shopId,
      variantKey: v.variantKey,
      attributes: v.attributes,
      image: v.image,
      regularPriceMinor: BigInt(v.regularPriceMinor),
      salePriceMinor: null,
      saleFrom: null,
      saleTo: null,
      status: "publish",
      sortOrder: v.sortOrder,
      manageStock: false,
      stockQuantity: null,
      stockStatus: v.inventory.stockStatus as "instock" | "outofstock" | "onbackorder",
      backorders: v.inventory.backorders as "no" | "notify" | "yes",
    })),
  }));
}

const now = new Date("2026-11-09T00:00:00Z");

/** The categories and shop-wide attributes as scripts/import/import-catalog.mjs puts them in the database. */
const taxonomy = (): Taxonomy => structuredClone({ categories: categoryRows(catalogJson), attributes: attributeRows(catalogJson, productPagesJson) }) as Taxonomy;

describe("catalogue from the database", () => {
  it("the imported rows give back the snapshot exactly", () => {
    const built = buildCatalog(base(), dbRows(), {}, now);
    expect(built.products).toEqual(snapshotProducts);
    expect(built.pages).toEqual(snapshotPages);
    expect(built.backorder).toEqual(stockStatusJson.backorder);
    expect(built.categories).toEqual(snapshotCategories);
  });

  it("the imported categories and attributes give back the snapshot exactly too", () => {
    const built = buildCatalog(base(), dbRows(), {}, now, taxonomy());
    expect(built.categories).toEqual(snapshotCategories);
    expect(built.shopCarousel).toEqual(snapshotShopCarousel());
    expect(built.products).toEqual(snapshotProducts);
    expect(built.pages).toEqual(snapshotPages);
    expect(taxonomy().attributes.map((a) => a.label)).toEqual(["Pen Type", "MG", "IU", "Storage"]);
  });

  it("a renamed or moved category shows its new name and address on cards, breadcrumbs, carousels and counts", () => {
    const t = taxonomy();
    const vial = t.categories.find((c) => c.slug === "vial")!;
    const healing = t.categories.find((c) => c.slug === "healing-recovery")!;
    const pens = t.categories.find((c) => c.slug === "pen-peptides")!;
    vial.name = "Vials";
    healing.parentId = pens.id;
    healing.sortOrder = -1;
    const built = buildCatalog(base(), dbRows(), {}, now, t);
    const category = (slug: string) => built.categories.find((c) => c.slug === slug)!;
    expect(category("healing-recovery").path).toBe("/product-category/pen-peptides/healing-recovery/");
    expect(category("pen-peptides").carousel[0].path).toBe("/product-category/pen-peptides/healing-recovery/");
    expect(category("vial").carousel.some((tile) => tile.path.includes("healing-recovery"))).toBe(false);
    // Counts follow: Healing & Recovery's products now count for Peptide Pens, not for Vials (unless also there).
    const healingProducts = snapshotProducts.filter((p) => p.categories.includes("healing-recovery"));
    expect(category("healing-recovery").count).toBe(healingProducts.length);
    expect(category("pen-peptides").count).toBe(snapshotProducts.filter((p) => p.categories.some((s) => ["pen-peptides", "atlas-longevity-pen-peptides", "healing-recovery"].includes(s))).length);
    // Cards and breadcrumbs.
    const card = built.products.find((p) => p.categories.includes("healing-recovery"))!;
    expect(card.cardCategories.map((c) => c.path)).toContain("/product-category/pen-peptides/healing-recovery/");
    const healed = built.pages.find((page) => snapshotPages.find((p) => p.id === page.id)!.breadcrumbs.some((c) => c.label === "Healing & Recovery"))!;
    expect(healed.breadcrumbs.map((c) => c.label)).toEqual(["Home", "Peptide Pens", "Healing & Recovery", healed.title]);
    // A product under another Vials sub-category: "Peptide Vials" is now "Vials" in its breadcrumb.
    const vialPage = built.pages.find((page) => snapshotPages.find((p) => p.id === page.id)!.breadcrumbs.some((c) => c.path === "/product-category/vial/"))!;
    expect(vialPage.breadcrumbs.find((c) => c.path === "/product-category/vial/")?.label).toBe("Vials");
    // Nothing else changed: a product outside these categories keeps its snapshot card and page.
    const touched = new Set(["vial", "pen-peptides", ...snapshotCategories.filter((c) => c.parent === vial.id || c.parent === pens.id).map((c) => c.slug)]);
    const other = snapshotProducts.find((p) => p.categories.length > 0 && p.categories.every((s) => !touched.has(s)))!;
    expect(built.products.find((p) => p.id === other.id)).toEqual(other);
    expect(built.pages.find((p) => p.id === other.id)).toEqual(snapshotPages.find((p) => p.id === other.id));
  });

  it("a new category (no products, no picture yet) gets its address, a placeholder tile and count 0", () => {
    const t = taxonomy();
    t.categories.push({ id: 300000, slug: "new-shelf", name: "New Shelf", parentId: 18, title: "New Shelf", sortOrder: 99, tileImage: null, searchImage: null, seo: { title: "New Shelf - Atlas Longevity", description: null, robots: "index, follow", ogType: "article", ogTitle: "New Shelf - Atlas Longevity", ogDescription: null } });
    const built = buildCatalog(base(), dbRows(), {}, now, t);
    const shelf = built.categories.find((c) => c.slug === "new-shelf")!;
    expect(shelf).toMatchObject({ path: "/product-category/vial/new-shelf/", count: 0, parent: 18 });
    expect(built.categories.find((c) => c.slug === "vial")!.carousel.at(-1)).toMatchObject({ path: "/product-category/vial/new-shelf/", name: "New Shelf", image: { src: "/images/product-placeholder.svg" } });
  });

  it("a shop-wide attribute's new name, display, value names and order show on every product using it", () => {
    const t = taxonomy();
    const mg = t.attributes.find((a) => a.slug === "mg")!;
    mg.label = "Strength";
    mg.swatches = false;
    mg.terms = [...mg.terms].reverse().map((term) => (term.value === "10" ? { ...term, label: "10 mg" } : term));
    const built = buildCatalog(base(), dbRows(), {}, now, t);
    const page = built.pages.find((p) => p.form.type === "variable" && p.form.attributes.some((a) => a.name === "attribute_pa_mg" && a.options.length > 2))!;
    const form = page.form.type === "variable" ? page.form.attributes.find((a) => a.name === "attribute_pa_mg")! : null;
    expect(form).toMatchObject({ label: "Strength", swatches: false });
    const before = snapshotPages.find((p) => p.id === page.id)!;
    const was = before.form.type === "variable" ? before.form.attributes.find((a) => a.name === "attribute_pa_mg")!.options.map((o) => o.value) : [];
    expect(form!.options.map((o) => o.value)).toEqual([...was].reverse());
    const card = built.products.find((p) => p.quickShop.some((a) => a.name === "attribute_pa_mg" && a.options.some((o) => o.value === "10")))!;
    expect(card.quickShop.find((a) => a.name === "attribute_pa_mg")!.options.find((o) => o.value === "10")!.label).toBe("10 mg");
  });

  it("archiving hides a product everywhere and drops it from related products", () => {
    const rows = dbRows();
    const target = rows[0];
    target.status = "archived";
    const built = buildCatalog(base(), rows, {}, now);
    expect(built.products.find((p) => p.id === target.shopId)).toBeUndefined();
    expect(built.pages.some((p) => p.related.includes(target.shopId))).toBe(false);
    expect(built.products).toHaveLength(snapshotProducts.length - 1);
  });

  it("price, sale dates, stock and name changes show", () => {
    const rows = dbRows();
    const simple = rows.find((r) => r.type === "simple")!;
    const variant = simple.variants[0];
    variant.regularPriceMinor = 123_400_00n;
    variant.salePriceMinor = 99_900_00n;
    variant.saleFrom = new Date("2026-11-01T00:00:00Z");
    variant.saleTo = new Date("2026-12-01T00:00:00Z");
    simple.name = "Renamed product";
    let built = buildCatalog(base(), rows, {}, now);
    let product = built.products.find((p) => p.id === simple.shopId)!;
    expect(product.priceMin).toBe(99_900_00n);
    expect(product.name).toBe("Renamed product");
    expect(built.pages.find((p) => p.id === simple.shopId)!.breadcrumbs.at(-1)!.label).toBe("Renamed product");
    // After the sale ends: the regular price.
    built = buildCatalog(base(), rows, {}, new Date("2026-12-02T00:00:00Z"));
    expect(built.products.find((p) => p.id === simple.shopId)!.priceMin).toBe(123_400_00n);
    // Managed stock at 0 without backorders: can't be bought; with backorders: on backorder.
    variant.manageStock = true;
    variant.stockQuantity = 0;
    built = buildCatalog(base(), rows, {}, now);
    product = built.products.find((p) => p.id === simple.shopId)!;
    expect(product.inStock).toBe(false);
    expect(built.pages.find((p) => p.id === simple.shopId)!.form.type).toBe("none");
    variant.backorders = "notify";
    built = buildCatalog(base(), rows, {}, now);
    expect(built.products.find((p) => p.id === simple.shopId)!.inStock).toBe(true);
    expect(built.backorder[String(simple.shopId)]).toEqual({ notify: true });
  });

  it("shows a variable product's regular price struck through only when all variations cost the same", () => {
    const rows = dbRows();
    const variable = rows.find((r) => r.type === "variable" && r.variants.filter((v) => v.regularPriceMinor > 0n).length >= 2)!;
    const priced = variable.variants.filter((v) => v.regularPriceMinor > 0n);
    // Same regular price everywhere, same sale price everywhere: one price, struck through.
    for (const v of priced) {
      v.regularPriceMinor = 500_000_00n;
      v.salePriceMinor = 400_000_00n;
    }
    let product = buildCatalog(base(), rows, {}, now).products.find((p) => p.id === variable.shopId)!;
    expect([product.priceMin, product.priceMax, product.regularPrice, product.onSale]).toEqual([400_000_00n, 400_000_00n, 500_000_00n, true]);
    expect(product.variations.find((v) => v.price > 0n)).toMatchObject({ onSale: true, regularPrice: 500_000_00n });
    // One variation not on sale: a range, nothing struck through on the card (variations still are).
    priced[0].salePriceMinor = null;
    product = buildCatalog(base(), rows, {}, now).products.find((p) => p.id === variable.shopId)!;
    expect(product.priceMin).not.toBe(product.priceMax);
    expect(product.regularPrice).toBeUndefined();
  });

  it("a product made in the admin gets a card and a page", () => {
    const rows = dbRows();
    rows.push({
      shopId: 200000,
      sanityId: "product-new-test",
      slug: "new-test",
      name: "New Test Peptide",
      type: "variable",
      status: "publish",
      categorySlugs: ["vial"],
      menuOrder: -1,
      publishedAt: now,
      attributes: [{ name: "attribute_pa_mg", label: "MG", swatches: true, options: [{ value: "5", label: "5 MG" }, { value: "10", label: "10 MG" }], default: null }],
      variants: [
        { shopId: 200001, variantKey: "mg=5", attributes: { attribute_pa_mg: "5" }, image: null, regularPriceMinor: 50_000_000n, salePriceMinor: null, saleFrom: null, saleTo: null, status: "publish", sortOrder: 0, manageStock: true, stockQuantity: 3, stockStatus: "instock", backorders: "no" },
        { shopId: 200002, variantKey: "mg=10", attributes: { attribute_pa_mg: "10" }, image: null, regularPriceMinor: 90_000_000n, salePriceMinor: null, saleFrom: null, saleTo: null, status: "publish", sortOrder: 1, manageStock: false, stockQuantity: null, stockStatus: "outofstock", backorders: "no" },
      ],
    });
    const built = buildCatalog(base(), rows, { "product-new-test": [{ url: "https://media.example.com/wp-content/uploads/2026/11/new.jpg", alt: "New", width: 800, height: 800 }] }, now);
    const product = built.products.find((p) => p.id === 200000)!;
    expect(product).toMatchObject({ path: "/product/new-test/", priceMin: 50_000_000n, priceMax: 90_000_000n, inStock: true });
    expect(product.ranks.menu_order).toBe(0); // menu order -1: first in the shop
    expect(product.image.src).toContain("new.jpg");
    expect(product.cardCategories.map((c) => c.path)).toEqual(["/product-category/vial/"]);
    const page = built.pages.find((p) => p.id === 200000)!;
    expect(page.form.type).toBe("variable");
    expect(page.breadcrumbs.map((c) => c.label)).toEqual(["Home", "Peptide Vials", "New Test Peptide"]);
    expect(page.afterAddToCart).toEqual([701]);
    expect(page.related.length).toBeGreaterThan(0);
  });
});
