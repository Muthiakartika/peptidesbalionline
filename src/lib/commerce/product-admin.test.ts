/**
 * The store admin's product operations on a real (in-memory) Postgres with every migration: create a
 * simple and a variable product, change price / sale / stock (written to the stock history), remove a
 * variation, archive, restore, delete — and refuse to delete a product that was ordered. Sanity isn't
 * connected in tests (the operations say so in a warning and still save).
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/content/sanity-write", () => ({ sanityWriter: () => null }));

const { archiveProduct, cleanProductInput, createProduct, deleteProduct, getEditorProduct, restoreProduct, updateProduct } = await import("./product-admin");
const { loadCatalogRows } = await import("@/lib/catalog/store");

let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  const pg = new PGlite();
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  db = drizzle(pg, { schema });
  state.db = db;
}, 60_000);

const stock = { manageStock: false, stockQuantity: null, stockStatus: "instock" as const, backorders: "no" as const };
const variant = (regularPrice: number, extra: Record<string, unknown> = {}) => ({ attributes: {}, regularPrice, salePrice: null, saleFrom: null, saleTo: null, sku: null, enabled: true, ...stock, ...extra });
const simpleInput = { name: "Test Peptide 5mg", slug: "", status: "publish" as const, type: "simple" as const, categorySlugs: ["vial"], menuOrder: 0, publishedAt: null, attributes: [], variants: [variant(850_000)] };

describe("product admin", () => {
  it("refuses forms that can't be saved, with the admin's words", async () => {
    expect(await cleanProductInput({ ...simpleInput, name: "" })).toBe("The product needs a name");
    expect(await cleanProductInput({ ...simpleInput, categorySlugs: [] })).toBe("Choose at least one category");
    expect(await cleanProductInput({ ...simpleInput, categorySlugs: ["nope"] })).toBe("Unknown category.");
    expect(await cleanProductInput({ ...simpleInput, variants: [variant(100, { salePrice: 200 })] })).toBe("The product: the sale price must be lower than the regular price.");
    expect(await cleanProductInput({ ...simpleInput, type: "variable", attributes: [] })).toBe("A variable product needs at least one attribute (e.g. MG).");
  });

  it("creates a simple product (address from the name, numbered from 200000) and reads it back", async () => {
    const result = await createProduct(simpleInput, "staff-1");
    expect(result).toMatchObject({ ok: true, shopId: 200000 });
    expect(result.ok && result.warning).toContain("Sanity isn't connected");
    const product = (await getEditorProduct(200000))!;
    expect(product).toMatchObject({ name: "Test Peptide 5mg", slug: "test-peptide-5mg", status: "publish", type: "simple", ordered: false });
    expect(product.variants[0]).toMatchObject({ regularPrice: 850_000, salePrice: null, enabled: true });
    expect(await createProduct(simpleInput, "staff-1")).toEqual({ ok: false, error: "The address /product/test-peptide-5mg/ is already used by another product." });
  });

  it("saves a sale and managed stock, and writes the stock change to the history", async () => {
    const product = (await getEditorProduct(200000))!;
    const result = await updateProduct(200000, { ...product, variants: [{ ...product.variants[0], salePrice: 700_000, manageStock: true, stockQuantity: 12 }] }, "staff-1");
    expect(result.ok).toBe(true);
    const [row] = await loadCatalogRows();
    expect(row.variants[0]).toMatchObject({ regularPriceMinor: 85_000_000n, salePriceMinor: 70_000_000n, manageStock: true, stockQuantity: 12 });
    const moves = await db.select().from(schema.inventoryMovements);
    expect(moves.map((m) => [m.delta, m.reason, m.actorUserId])).toEqual([[12, "manual", "staff-1"]]);
    // Down to 9: one more movement of -3.
    const again = (await getEditorProduct(200000))!;
    await updateProduct(200000, { ...again, variants: [{ ...again.variants[0], stockQuantity: 9 }] }, "staff-2");
    expect((await db.select().from(schema.inventoryMovements)).map((m) => m.delta)).toEqual([12, -3]);
  });

  it("creates a variable product with numbered variations, then removes one", async () => {
    // A product-only attribute (typed in the product form): attribute_<slug>, like WooCommerce's custom ones.
    const input = {
      ...simpleInput,
      name: "Test Pen",
      type: "variable" as const,
      attributes: [{ label: "Strength", swatches: true, options: [{ label: "5 MG" }, { label: "10 MG" }], default: null }],
      variants: [variant(500_000, { attributes: { attribute_strength: "5-mg" } }), variant(900_000, { attributes: { attribute_strength: "10-mg" } })],
    };
    const created = await createProduct(input, "staff-1");
    expect(created.ok).toBe(true);
    const shopId = created.ok ? created.shopId : 0;
    const product = (await getEditorProduct(shopId))!;
    expect(product.attributes[0]).toMatchObject({ name: "attribute_strength", options: [{ value: "5-mg", label: "5 MG" }, { value: "10-mg", label: "10 MG" }] });
    expect(product.variants.map((v) => v.shopId)).toEqual([shopId + 1, shopId + 2]);
    // Remove the 10 MG variation: never ordered, no stock history → deleted.
    await updateProduct(shopId, { ...product, variants: [product.variants[0]] }, "staff-1");
    expect((await getEditorProduct(shopId))!.variants).toHaveLength(1);
  });

  it("takes a shop-wide attribute's name, display and values from /admin/attributes/", async () => {
    await db.insert(schema.productAttributes).values({ slug: "mg", label: "MG", swatches: true, terms: [{ value: "5", label: "5 MG" }, { value: "10", label: "10 MG" }, { value: "20", label: "20 MG" }] });
    const base = { ...simpleInput, name: "Global Attribute Test", type: "variable" as const, variants: [variant(400_000, { attributes: { attribute_pa_mg: "20" } }), variant(300_000, { attributes: { attribute_pa_mg: "5" } })] };
    // Values in the attribute's order, its own names and display, whatever the form sent.
    const clean = await cleanProductInput({ ...base, attributes: [{ name: "attribute_pa_mg", label: "x", swatches: false, options: [{ value: "20", label: "?" }, { value: "5", label: "?" }], default: "5" }] });
    expect(typeof clean !== "string" && clean.attributes).toEqual([{ name: "attribute_pa_mg", label: "MG", swatches: true, options: [{ value: "5", label: "5 MG" }, { value: "20", label: "20 MG" }], default: "5" }]);
    // A value the attribute doesn't have, or the attribute typed by hand: told where to go instead.
    expect(await cleanProductInput({ ...base, attributes: [{ name: "attribute_pa_mg", label: "MG", swatches: true, options: [{ value: "7", label: "7 MG" }], default: null }] })).toBe('MG has no value "7 MG": add it in Attributes first.');
    expect(await cleanProductInput({ ...base, attributes: [{ label: "mg", swatches: true, options: [{ label: "5 MG" }], default: null }] })).toBe("MG is a shop-wide attribute: choose it from the list instead of typing it.");
    await db.delete(schema.productAttributes);
  });

  it("archives (hidden from the shop), restores, and deletes a never-ordered product", async () => {
    expect((await archiveProduct(200000)).ok).toBe(true);
    let rows = await loadCatalogRows();
    expect(rows.find((r) => r.shopId === 200000)!.status).toBe("archived");
    expect((await restoreProduct(200000)).ok).toBe(true);
    rows = await loadCatalogRows();
    expect(rows.find((r) => r.shopId === 200000)!.status).toBe("publish");
    expect(await deleteProduct(200000)).toEqual({ ok: false, error: "Archive the product first; only archived products can be deleted." });
    await archiveProduct(200000);
    expect((await deleteProduct(200000)).ok).toBe(true);
    expect(await getEditorProduct(200000)).toBeNull();
    // Its stock history went with it.
    expect(await db.select().from(schema.inventoryMovements)).toEqual([]);
  });

  it("keeps a product that was ordered: it can be archived, not deleted", async () => {
    const created = await createProduct({ ...simpleInput, name: "Ordered Peptide" }, "staff-1");
    const shopId = created.ok ? created.shopId : 0;
    const [order] = await db
      .insert(schema.orders)
      .values({ orderKey: "wc_order_testordered1", status: "processing", subtotalMinor: 85_000_000n, totalMinor: 85_000_000n, billingEmail: "buyer@example.com", billing: {}, paymentMethod: "bacs", paymentMethodTitle: "Bank" })
      .returning({ id: schema.orders.id });
    await db.insert(schema.orderItems).values({ orderId: order.id, legacyWcProductId: shopId, productName: "Ordered Peptide", quantity: 1, unitPriceMinor: 85_000_000n, lineSubtotalMinor: 85_000_000n, lineTotalMinor: 85_000_000n });
    expect((await getEditorProduct(shopId))!.ordered).toBe(true);
    await archiveProduct(shopId);
    const refused = await deleteProduct(shopId);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.error).toContain("has been ordered before");
    expect((await db.select().from(schema.productRecords).where(eq(schema.productRecords.shopId, shopId))).length).toBe(1);
  });
});
