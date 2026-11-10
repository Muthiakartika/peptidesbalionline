/**
 * The store admin's categories and shop-wide attributes on a real (in-memory) Postgres with every
 * migration and the live shop's 25 categories and 4 attributes imported (as import-catalog.mjs does):
 * make, rename, move and delete categories, and change attributes, with the rules that keep products,
 * coupons and variations whole.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

import catalogJson from "@/content/catalog.json";
import productPagesJson from "@/content/product-pages.json";
import * as schema from "@/db/schema";

import { attributeRows, categoryRows } from "../../../scripts/import/catalog-mapping.mjs";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/content/sanity-write", () => ({ sanityWriter: () => null }));

const admin = await import("./taxonomy-admin");

let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  const pg = new PGlite();
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  db = drizzle(pg, { schema });
  state.db = db;
  await db.insert(schema.productCategories).values(categoryRows(catalogJson));
  await db.insert(schema.productAttributes).values(attributeRows(catalogJson, productPagesJson));
}, 60_000);

const form = (patch: Partial<Parameters<typeof admin.createCategory>[0] & object> = {}) => ({ name: "Test Shelf", slug: "", parentId: 18, title: "", sortOrder: 50, picture: "", seoTitle: "", seoDescription: "", ...patch });

describe("categories", () => {
  it("lists the imported tree with its addresses, parents first", async () => {
    const list = await admin.listAdminCategories();
    expect(list).toHaveLength(25);
    const vial = list.find((c) => c.slug === "vial")!;
    const healing = list.find((c) => c.slug === "healing-recovery")!;
    expect(healing).toMatchObject({ path: "/product-category/vial/healing-recovery/", depth: 1 });
    expect(list.indexOf(vial)).toBeLessThan(list.indexOf(healing));
    expect(vial.children).toBe(11);
  });

  it("makes a category under a parent, with live's automatic heading and SEO tags", async () => {
    const result = await admin.createCategory(form());
    expect(result.ok).toBe(true);
    const made = (await admin.getEditorCategory(Number(result.ok && result.id)))!;
    expect(made).toMatchObject({ id: 300000, slug: "test-shelf", parentId: 18, title: "Test Shelf", path: "/product-category/vial/test-shelf/", tileImage: null, searchImage: null });
    expect(made.seo).toMatchObject({ title: "Test Shelf in Bali - Atlas Longevity", ogTitle: "Test Shelf in Bali - Atlas Longevity", ogType: "article" });
    expect(made.seo.description).toBe(admin.defaultCategorySeoDescription("Test Shelf"));
    // The live categories' tags are the same pattern.
    const bundles = (await admin.listAdminCategories()).find((c) => c.slug === "bundles")!;
    expect([bundles.seo.title, bundles.seo.description]).toEqual([admin.defaultCategorySeoTitle("Bundles"), admin.defaultCategorySeoDescription("Bundles")]);
  });

  it("refuses an address in use, a reserved one, a bad picture, and moving a category under itself", async () => {
    expect(await admin.createCategory(form({ name: "Peptide Vials", slug: "vial" }))).toEqual({ ok: false, error: "The address vial is already used by another category." });
    expect(await admin.createCategory(form({ name: "Page" }))).toEqual({ ok: false, error: '"page" can\'t be a category address. Please choose another one.' });
    expect(await admin.createCategory(form({ name: "X", picture: "javascript:alert(1)" }))).toMatchObject({ ok: false });
    expect(await admin.updateCategory(18, form({ name: "Peptide Vials", parentId: 300000 }))).toEqual({ ok: false, error: "A category can't be placed under itself or one of its sub-categories." });
  });

  it("renaming keeps the address; automatic heading and SEO follow the new name, typed ones stay", async () => {
    const made = (await admin.getEditorCategory(300000))!;
    expect((await admin.updateCategory(300000, form({ name: "Lab Shelf", title: made.title, seoTitle: made.seo.title, seoDescription: "My own words.", picture: "https://example.com/shelf.webp" }))).ok).toBe(true);
    const renamed = (await admin.getEditorCategory(300000))!;
    expect(renamed).toMatchObject({ slug: "test-shelf", name: "Lab Shelf", title: "Lab Shelf", tileImage: { src: "https://example.com/shelf.webp", width: 300, height: 300, alt: "Lab Shelf" } });
    expect(renamed.seo).toMatchObject({ title: "Lab Shelf in Bali - Atlas Longevity", description: "My own words.", ogTitle: "Lab Shelf in Bali - Atlas Longevity", ogDescription: "My own words." });
  });

  it("deletes only what nothing uses: not with products, sub-categories or coupons", async () => {
    expect(await admin.deleteCategory(18)).toMatchObject({ ok: false, error: expect.stringContaining("sub-categories") });
    await db.insert(schema.productRecords).values({ sanityId: "product-shelf-item", shopId: 200500, slug: "shelf-item", name: "Shelf Item", type: "simple", status: "archived", categorySlugs: ["test-shelf"] });
    expect(await admin.deleteCategory(300000)).toMatchObject({ ok: false, error: expect.stringContaining("1 product is in it (Shelf Item)") });
    await db.delete(schema.productRecords);
    await db.insert(schema.coupons).values({ code: "shelf10", type: "percent", amount: "10", categorySlugs: ["test-shelf"] });
    expect(await admin.deleteCategory(300000)).toMatchObject({ ok: false, error: expect.stringContaining('"shelf10"') });
    await db.delete(schema.coupons);
    expect(await admin.deleteCategory(300000)).toEqual({ ok: true, id: "300000" });
    expect(await admin.getEditorCategory(300000)).toBeNull();
  });
});

describe("shop-wide attributes", () => {
  it("lists the four imported attributes with their values in the shop's order", async () => {
    const list = await admin.listAdminAttributes();
    expect(list.map((a) => a.label)).toEqual(["IU", "MG", "Pen Type", "Storage"]);
    expect(list.find((a) => a.slug === "pen-type")!.terms.map((t) => t.label)).toEqual(["Disposable Pen", "Reusable Pen", "Cartridge"]);
  });

  it("renames and reorders values (they keep their value) and adds new ones", async () => {
    const mg = (await admin.getEditorAttribute("mg"))!;
    const terms = [...mg.terms.map((t) => ({ value: t.value, label: t.value === "10" ? "10 mg" : t.label })).reverse(), { label: "250 MG" }];
    expect((await admin.updateAttribute("mg", { label: "MG", slug: "", swatches: false, terms })).ok).toBe(true);
    const saved = (await admin.getEditorAttribute("mg"))!;
    expect(saved.swatches).toBe(false);
    expect(saved.terms[0].value).toBe(mg.terms.at(-1)!.value);
    expect(saved.terms.at(-1)).toMatchObject({ value: "250-mg", label: "250 MG", products: 0 });
    expect(saved.terms.find((t) => t.value === "10")!.label).toBe("10 mg");
  });

  it("removes a value or the attribute only when no product uses it", async () => {
    await db.insert(schema.productRecords).values({
      sanityId: "product-mg-user",
      shopId: 200600,
      slug: "mg-user",
      name: "MG User",
      type: "variable",
      status: "draft",
      attributes: [{ name: "attribute_pa_mg", label: "MG", swatches: true, options: [{ value: "10", label: "10 MG" }], default: null }],
    });
    const mg = (await admin.getEditorAttribute("mg"))!;
    expect(await admin.updateAttribute("mg", { label: "MG", slug: "", swatches: true, terms: mg.terms.filter((t) => t.value !== "10") })).toEqual({ ok: false, error: '"10 mg" is used by 1 product (MG User): remove it from that product first.' });
    expect((await admin.updateAttribute("mg", { label: "MG", slug: "", swatches: true, terms: mg.terms.filter((t) => t.value !== "250-mg") })).ok).toBe(true);
    expect(await admin.deleteAttribute("mg")).toEqual({ ok: false, error: "This attribute can't be deleted: 1 product uses it (MG User)." });
    await db.delete(schema.productRecords);
    expect((await admin.createAttribute({ label: "Purity", slug: "", swatches: false, terms: [{ label: "99%" }, { label: "98%" }] })).ok).toBe(true);
    expect((await admin.getEditorAttribute("purity"))!.terms.map((t) => t.value)).toEqual(["99", "98"]);
    expect(await admin.createAttribute({ label: "Purity", slug: "", swatches: false, terms: [] })).toEqual({ ok: false, error: "An attribute with the slug purity already exists." });
    expect(await admin.deleteAttribute("purity")).toEqual({ ok: true, id: "purity" });
  });
});
