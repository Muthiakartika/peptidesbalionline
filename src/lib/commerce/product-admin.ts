/**
 * The store admin's product operations (/admin/products/): create, update, archive, restore and delete
 * products, their variations, prices and stock, in one database transaction each. Sanity's product
 * document (texts and pictures) is kept in step: made on create, renamed with the product, marked when
 * archived, removed on delete; editors never create or delete products in the Studio.
 *
 * Rules (WooCommerce's, and what keeps the order history whole):
 *   * a product that was ever ordered can't be deleted, only archived (orders keep pointing at it);
 *   * a variation that was ever ordered or had stock movements is disabled instead of deleted;
 *   * every change to a managed stock quantity is written to inventory_movements (who, how much).
 */
import "server-only";

import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { inventory, inventoryMovements, orderItems, productAttributes, productRecords, productVariants, type ProductAttribute, type VariantImage } from "@/db/schema";
import { getCategories } from "@/lib/catalog";
import { sanityWriter } from "@/lib/content/sanity-write";
import { legacyRedirects } from "@/lib/seo/redirects";

import { customAttributeName, slugify } from "./slug";

export { slugify };

const MINOR = 100n;

/** A variation's stable key from its attributes (as scripts/import/catalog-mapping.mjs builds it). */
export function variantKeyOf(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return "default";
  return entries.map(([name, value]) => `${name.replace(/^attribute_(pa_)?/, "")}=${value || "*"}`).join(";");
}

const money = z.number().int().min(0).max(1_000_000_000_000);
const isoDate = z.string().datetime({ offset: true }).nullable();

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.string()),
  regularPrice: money,
  salePrice: money.nullable(),
  saleFrom: isoDate,
  saleTo: isoDate,
  sku: z.string().trim().max(100).nullable(),
  enabled: z.boolean(),
  manageStock: z.boolean(),
  stockQuantity: z.number().int().min(0).max(10_000_000).nullable(),
  stockStatus: z.enum(["instock", "outofstock", "onbackorder"]),
  backorders: z.enum(["no", "notify", "yes"]),
  image: z.object({ src: z.string().min(1), srcset: z.string().nullable(), sizes: z.string().nullable(), alt: z.string(), width: z.number().optional(), height: z.number().optional() }).nullable().optional(),
});

const attributeSchema = z.object({
  name: z.string().optional(),
  label: z.string().trim().min(1, "Every attribute needs a name").max(60),
  swatches: z.boolean(),
  options: z.array(z.object({ value: z.string().optional(), label: z.string().trim().min(1).max(60) })).min(1, "Every attribute needs at least one value"),
  default: z.string().nullable(),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "The product needs a name").max(200),
  slug: z.string().trim().max(190),
  status: z.enum(["publish", "draft", "private"]),
  type: z.enum(["simple", "variable"]),
  categorySlugs: z.array(z.string()).min(1, "Choose at least one category"),
  menuOrder: z.number().int().min(-100000).max(100000),
  publishedAt: isoDate,
  attributes: z.array(attributeSchema).max(3),
  variants: z.array(variantSchema).min(1),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type AdminResult = { ok: true; shopId: number; warning?: string } | { ok: false; error: string };

type CleanProduct = {
  name: string;
  slug: string;
  status: "publish" | "draft" | "private";
  type: "simple" | "variable";
  categorySlugs: string[];
  menuOrder: number;
  publishedAt: Date | null;
  attributes: ProductAttribute[];
  variants: (VariantInput & { variantKey: string; image: VariantImage | null })[];
};

/** The shop-wide attributes (/admin/attributes/) by their products' field name, attribute_pa_<slug>. */
async function shopAttributeMap(): Promise<Map<string, { slug: string; label: string; swatches: boolean; terms: { value: string; label: string }[] }>> {
  const rows = await getDb().select().from(productAttributes);
  return new Map(rows.map((a) => [`attribute_pa_${a.slug}`, a]));
}

/**
 * Checks and tidies what the form sent; an error message (in the admin's words) when it can't be saved.
 * A shop-wide attribute (MG, Pen Type…) takes its name, display and value names from /admin/attributes/
 * and only its values there; a product-only one (e.g. Vial Size) is written as attribute_<slug>.
 */
export async function cleanProductInput(raw: unknown): Promise<CleanProduct | string> {
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Please check the form.";
  const input = parsed.data;
  const slug = slugify(input.slug || input.name);
  if (!slug) return "The address (slug) needs letters or numbers.";
  // The live site's old addresses are answered before any page (next.config.ts): a product there could never be opened.
  const forwarded = legacyRedirects().find((r) => r.source.toLowerCase() === `/product/${slug}/`);
  if (forwarded) return `The address /product/${slug}/ is an old address of the shop that already forwards to ${forwarded.destination}. Please choose another address.`;
  const known = new Set((await getCategories()).map((c) => c.slug));
  if (input.categorySlugs.some((s) => !known.has(s))) return "Unknown category.";

  const attributes: ProductAttribute[] = [];
  const shop = input.type === "variable" && input.attributes.length ? await shopAttributeMap() : new Map();
  for (const a of input.type === "variable" ? input.attributes : []) {
    const global = a.name ? shop.get(a.name) : undefined;
    if (global) {
      const values = a.options.map((o) => o.value || slugify(o.label));
      const missing = values.find((value) => !global.terms.some((t: { value: string }) => t.value === value));
      if (missing !== undefined) return `${global.label} has no value "${a.options[values.indexOf(missing)].label}": add it in Attributes first.`;
      const options = global.terms.filter((t: { value: string }) => values.includes(t.value)).map((t: { value: string; label: string }) => ({ value: t.value, label: t.label }));
      attributes.push({ name: a.name!, label: global.label, swatches: global.swatches, options, default: a.default && values.includes(a.default) ? a.default : null });
      continue;
    }
    // A product-only attribute keeps its field name once made (its variations use it), even when its
    // label is changed; a new one is named from its label. A shop-wide one that no longer exists is
    // refused (before the attributes were imported, any attribute_pa_* is kept as it is).
    if (a.name?.startsWith("attribute_pa_") && shop.size) return `The shop-wide attribute "${a.label}" doesn't exist any more: choose another one.`;
    const name = a.name || customAttributeName(a.label);
    const sameAsShop = a.name ? undefined : [...shop.values()].find((g) => slugify(g.label) === slugify(a.label) || g.slug === slugify(a.label));
    if (sameAsShop) return `${sameAsShop.label} is a shop-wide attribute: choose it from the list instead of typing it.`;
    const options = a.options.map((o) => ({ value: o.value || slugify(o.label), label: o.label }));
    attributes.push({ name, label: a.label, swatches: a.swatches, options, default: a.default && options.some((o) => o.value === a.default) ? a.default : null });
  }
  if (input.type === "variable" && !attributes.length) return "A variable product needs at least one attribute (e.g. MG).";
  if (new Set(attributes.map((a) => a.name)).size !== attributes.length) return "Two attributes have the same name.";
  for (const a of attributes) if (new Set(a.options.map((o) => o.value)).size !== a.options.length) return `"${a.label}" has the same value twice.`;
  if (input.type === "simple" && input.variants.length !== 1) return "A simple product has exactly one price and stock.";

  const variants: CleanProduct["variants"] = [];
  const keys = new Set<string>();
  for (const [index, v] of input.variants.entries()) {
    const label = input.type === "variable" ? `Variation ${index + 1}` : "The product";
    if (v.salePrice !== null && v.salePrice >= v.regularPrice) return `${label}: the sale price must be lower than the regular price.`;
    if (v.saleFrom && v.saleTo && new Date(v.saleTo) <= new Date(v.saleFrom)) return `${label}: the sale must end after it starts.`;
    if (v.manageStock && v.stockQuantity === null) return `${label}: enter the stock quantity (or switch off "Manage stock").`;
    const attrs: Record<string, string> = {};
    if (input.type === "variable") {
      for (const a of attributes) {
        const value = v.attributes[a.name] ?? "";
        if (value && !a.options.some((o) => o.value === value)) return `${label}: unknown ${a.label} value.`;
        attrs[a.name] = value;
      }
    }
    const variantKey = variantKeyOf(attrs);
    if (keys.has(variantKey)) return `${label}: two variations have the same options.`;
    keys.add(variantKey);
    variants.push({ ...v, attributes: attrs, variantKey, sku: v.sku || null, image: v.image ?? null });
  }
  return {
    name: input.name,
    slug,
    status: input.status,
    type: input.type,
    categorySlugs: input.categorySlugs,
    menuOrder: input.menuOrder,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    attributes,
    variants,
  };
}

const toMinor = (rupiah: number) => BigInt(rupiah) * MINOR;
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function writeVariant(tx: Tx, productId: string, product: CleanProduct, v: CleanProduct["variants"][number], sortOrder: number, actorUserId: string) {
  const regular = toMinor(v.regularPrice);
  const sale = v.salePrice === null ? null : toMinor(v.salePrice);
  const values = {
    variantKey: v.variantKey,
    attributes: v.attributes,
    image: v.image,
    sku: v.sku,
    regularPriceMinor: regular,
    salePriceMinor: sale,
    priceMinor: sale !== null && (!v.saleFrom || new Date(v.saleFrom) <= new Date()) && (!v.saleTo || new Date(v.saleTo) > new Date()) ? sale : regular,
    saleFrom: v.saleFrom ? new Date(v.saleFrom) : null,
    saleTo: v.saleTo ? new Date(v.saleTo) : null,
    status: (v.enabled ? "publish" : "private") as "publish" | "private",
    sortOrder,
    updatedAt: new Date(),
  };
  let variantId = v.id;
  let previousQuantity: number | null = null;
  if (variantId) {
    const [stock] = await tx.select({ manage: inventory.manageStock, quantity: inventory.stockQuantity }).from(inventory).where(eq(inventory.variantId, variantId));
    previousQuantity = stock?.manage ? (stock.quantity ?? 0) : null;
    await tx.update(productVariants).set(values).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
  } else {
    const [row] = await tx
      .insert(productVariants)
      .values({ ...values, productId, shopId: product.type === "variable" ? sql`nextval('shop_id_seq')` : null })
      .returning({ id: productVariants.id });
    variantId = row.id;
  }
  const stock = { manageStock: v.manageStock, stockQuantity: v.manageStock ? v.stockQuantity : null, stockStatus: v.stockStatus, backorders: v.backorders, updatedAt: new Date() };
  await tx.insert(inventory).values({ variantId, ...stock }).onConflictDoUpdate({ target: inventory.variantId, set: stock });
  const now = v.manageStock ? (v.stockQuantity ?? 0) : null;
  if (now !== null && now !== (previousQuantity ?? 0)) {
    await tx.insert(inventoryMovements).values({ variantId, delta: now - (previousQuantity ?? 0), reason: "manual", actorUserId, note: previousQuantity === null ? "Stock managed from the store admin" : "Changed in the store admin" });
  }
}

/** Has this product (or one of these variations) ever been ordered? */
async function wasOrdered(tx: Tx | ReturnType<typeof getDb>, shopId: number, variantIds: string[], variantShopIds: number[]) {
  const conditions = [eq(orderItems.legacyWcProductId, shopId)];
  if (variantIds.length) conditions.push(inArray(orderItems.variantId, variantIds));
  if (variantShopIds.length) conditions.push(inArray(orderItems.legacyWcVariationId, variantShopIds));
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(or(...conditions));
  return (row?.n ?? 0) > 0;
}

async function syncSanity(record: { sanityId: string; name: string; slug: string; type: string; shopId: number; status: string }): Promise<string | undefined> {
  const client = sanityWriter();
  if (!client) return "Sanity isn't connected here: the product's texts and pictures document wasn't updated.";
  try {
    await client.createIfNotExists({ _id: record.sanityId, _type: "product", name: record.name, slug: { _type: "slug", current: record.slug }, productType: record.type });
    await client.patch(record.sanityId).set({ name: record.name, "slug.current": record.slug, productType: record.type, shopId: record.shopId, storeStatus: record.status }).commit();
    return undefined;
  } catch (error) {
    return `Saved, but Sanity couldn't be updated (${error instanceof Error ? error.message.slice(0, 120) : "error"}).`;
  }
}

export async function createProduct(raw: unknown, actorUserId: string): Promise<AdminResult> {
  const product = await cleanProductInput(raw);
  if (typeof product === "string") return { ok: false, error: product };
  const db = getDb();
  const [taken] = await db.select({ id: productRecords.id }).from(productRecords).where(eq(productRecords.slug, product.slug));
  if (taken) return { ok: false, error: `The address /product/${product.slug}/ is already used by another product.` };
  const sanityId = `product-${product.slug}`;
  const created = await db.transaction(async (tx) => {
    const [record] = await tx
      .insert(productRecords)
      .values({
        sanityId,
        slug: product.slug,
        name: product.name,
        type: product.type,
        status: product.status,
        categorySlugs: product.categorySlugs,
        menuOrder: product.menuOrder,
        publishedAt: product.publishedAt ?? new Date(),
        attributes: product.attributes,
      })
      .returning({ id: productRecords.id, shopId: productRecords.shopId });
    for (const [i, v] of product.variants.entries()) await writeVariant(tx, record.id, product, { ...v, id: undefined }, i, actorUserId);
    return record;
  });
  const warning = await syncSanity({ sanityId, name: product.name, slug: product.slug, type: product.type, shopId: created.shopId, status: product.status });
  return { ok: true, shopId: created.shopId, ...(warning ? { warning } : {}) };
}

export async function updateProduct(shopId: number, raw: unknown, actorUserId: string): Promise<AdminResult> {
  const product = await cleanProductInput(raw);
  if (typeof product === "string") return { ok: false, error: product };
  const db = getDb();
  const [record] = await db.select().from(productRecords).where(eq(productRecords.shopId, shopId));
  if (!record) return { ok: false, error: "This product doesn't exist any more." };
  if (record.type !== product.type) return { ok: false, error: "The product type can't be changed after it was created." };
  const [taken] = await db.select({ id: productRecords.id }).from(productRecords).where(and(eq(productRecords.slug, product.slug), ne(productRecords.id, record.id)));
  if (taken) return { ok: false, error: `The address /product/${product.slug}/ is already used by another product.` };
  // As WordPress keeps _wp_old_slug: the address it had keeps working (301 to the new one, src/proxy.ts);
  // going back to an earlier address takes that one off the list.
  const oldSlugs = [...new Set([...record.oldSlugs, ...(record.slug !== product.slug ? [record.slug] : [])])].filter((s) => s !== product.slug);
  await db.transaction(async (tx) => {
    await tx
      .update(productRecords)
      .set({
        slug: product.slug,
        oldSlugs,
        name: product.name,
        status: record.status === "archived" ? "archived" : product.status,
        statusBeforeArchive: record.status === "archived" ? product.status : record.statusBeforeArchive,
        categorySlugs: product.categorySlugs,
        menuOrder: product.menuOrder,
        publishedAt: product.publishedAt ?? record.publishedAt,
        attributes: product.attributes,
        updatedAt: new Date(),
      })
      .where(eq(productRecords.id, record.id));
    const existing = await tx.select({ id: productVariants.id, shopId: productVariants.shopId }).from(productVariants).where(eq(productVariants.productId, record.id));
    const kept = new Set(product.variants.map((v) => v.id).filter(Boolean));
    // Variations removed in the form: deleted, unless orders or the stock history need them (then disabled).
    for (const gone of existing.filter((v) => !kept.has(v.id))) {
      const [moves] = await tx.select({ n: sql<number>`count(*)::int` }).from(inventoryMovements).where(eq(inventoryMovements.variantId, gone.id));
      const ordered = await wasOrdered(tx, -1, [gone.id], gone.shopId ? [gone.shopId] : []);
      if (ordered || (moves?.n ?? 0) > 0) await tx.update(productVariants).set({ status: "private", updatedAt: new Date() }).where(eq(productVariants.id, gone.id));
      else await tx.delete(productVariants).where(eq(productVariants.id, gone.id));
    }
    for (const [i, v] of product.variants.entries()) await writeVariant(tx, record.id, product, v.id && existing.some((e) => e.id === v.id) ? v : { ...v, id: undefined }, i, actorUserId);
  });
  const warning = await syncSanity({ sanityId: record.sanityId, name: product.name, slug: product.slug, type: product.type, shopId, status: record.status === "archived" ? "archived" : product.status });
  return { ok: true, shopId, ...(warning ? { warning } : {}) };
}

/** Archive: the product leaves the shop (listings, search, its address answers 404); orders keep it. */
export async function archiveProduct(shopId: number): Promise<AdminResult> {
  const db = getDb();
  const [record] = await db.select().from(productRecords).where(eq(productRecords.shopId, shopId));
  if (!record) return { ok: false, error: "This product doesn't exist any more." };
  if (record.status === "archived") return { ok: true, shopId };
  await db.update(productRecords).set({ status: "archived", statusBeforeArchive: record.status, updatedAt: new Date() }).where(eq(productRecords.id, record.id));
  const warning = await syncSanity({ ...record, type: record.type, status: "archived" });
  return { ok: true, shopId, ...(warning ? { warning } : {}) };
}

/** Restore an archived product to what it was before (published, draft or private). */
export async function restoreProduct(shopId: number): Promise<AdminResult> {
  const db = getDb();
  const [record] = await db.select().from(productRecords).where(eq(productRecords.shopId, shopId));
  if (!record) return { ok: false, error: "This product doesn't exist any more." };
  const status = record.statusBeforeArchive ?? "draft";
  await db.update(productRecords).set({ status, statusBeforeArchive: null, updatedAt: new Date() }).where(eq(productRecords.id, record.id));
  const warning = await syncSanity({ ...record, type: record.type, status });
  return { ok: true, shopId, ...(warning ? { warning } : {}) };
}

/**
 * Delete for good: only an archived product that was never ordered (with its variations, stock and
 * stock history, and its Sanity document). Ordered products stay archived so the orders keep them.
 */
export async function deleteProduct(shopId: number): Promise<AdminResult> {
  const db = getDb();
  const [record] = await db.select().from(productRecords).where(eq(productRecords.shopId, shopId));
  if (!record) return { ok: false, error: "This product doesn't exist any more." };
  if (record.status !== "archived") return { ok: false, error: "Archive the product first; only archived products can be deleted." };
  const variants = await db.select({ id: productVariants.id, shopId: productVariants.shopId }).from(productVariants).where(eq(productVariants.productId, record.id));
  if (await wasOrdered(db, shopId, variants.map((v) => v.id), variants.flatMap((v) => (v.shopId ? [v.shopId] : [])))) {
    return { ok: false, error: "This product has been ordered before, so it stays archived: the orders still show it. It is already hidden from the shop." };
  }
  await db.transaction(async (tx) => {
    if (variants.length) await tx.delete(inventoryMovements).where(inArray(inventoryMovements.variantId, variants.map((v) => v.id)));
    await tx.delete(productVariants).where(eq(productVariants.productId, record.id));
    await tx.delete(productRecords).where(eq(productRecords.id, record.id));
  });
  const client = sanityWriter();
  let warning: string | undefined;
  if (client) {
    try {
      await client.transaction().delete(record.sanityId).delete(`drafts.${record.sanityId}`).commit();
    } catch (error) {
      warning = `Deleted, but its Sanity document couldn't be removed (${error instanceof Error ? error.message.slice(0, 120) : "error"}).`;
    }
  }
  return { ok: true, shopId, ...(warning ? { warning } : {}) };
}

// ---------------------------------------------------------------------------------------------
// Reading products for the admin screens
// ---------------------------------------------------------------------------------------------

const toRupiah = (minor: bigint | null) => (minor === null ? null : Number(minor / MINOR));

export type EditorVariant = VariantInput & { id: string; shopId: number | null };
export type EditorProduct = Omit<ProductInput, "variants"> & { shopId: number; sanityId: string; storeStatus: string; variants: EditorVariant[]; ordered: boolean };

/** One product as the edit screen shows it (prices in rupiah). */
export async function getEditorProduct(shopId: number): Promise<EditorProduct | null> {
  const db = getDb();
  const [record] = await db.select().from(productRecords).where(eq(productRecords.shopId, shopId));
  if (!record) return null;
  const rows = await db
    .select({ v: productVariants, stock: inventory })
    .from(productVariants)
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(productVariants.productId, record.id))
    .orderBy(productVariants.sortOrder);
  const variants: EditorVariant[] = rows.map(({ v, stock }) => ({
    id: v.id,
    shopId: v.shopId,
    attributes: Object.fromEntries(Object.entries(v.attributes ?? {}).map(([k, value]) => [k, value ?? ""])),
    regularPrice: toRupiah(v.regularPriceMinor) ?? 0,
    salePrice: toRupiah(v.salePriceMinor),
    saleFrom: v.saleFrom?.toISOString() ?? null,
    saleTo: v.saleTo?.toISOString() ?? null,
    sku: v.sku,
    enabled: v.status === "publish",
    manageStock: stock?.manageStock ?? false,
    stockQuantity: stock?.stockQuantity ?? null,
    stockStatus: stock?.stockStatus ?? "instock",
    backorders: stock?.backorders ?? "no",
    image: v.image ?? null,
  }));
  const ordered = await wasOrdered(db, shopId, variants.map((v) => v.id), variants.flatMap((v) => (v.shopId ? [v.shopId] : [])));
  return {
    shopId,
    sanityId: record.sanityId,
    storeStatus: record.status,
    ordered,
    name: record.name,
    slug: record.slug,
    status: record.status === "archived" ? (record.statusBeforeArchive === "archived" ? "draft" : (record.statusBeforeArchive ?? "draft")) : record.status,
    type: record.type,
    categorySlugs: record.categorySlugs,
    menuOrder: record.menuOrder,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    attributes: record.attributes.map((a) => ({ ...a, options: a.options.map((o) => ({ ...o })) })),
    variants,
  };
}

export type AdminListRow = {
  shopId: number;
  name: string;
  slug: string;
  status: string;
  type: "simple" | "variable";
  categorySlugs: string[];
  priceMin: number | null;
  priceMax: number | null;
  stock: string;
  variants: number;
  onSale: boolean;
  updatedAt: Date;
};

/** Every product for the list screen, with its price range and a stock summary. */
export async function listAdminProducts(): Promise<AdminListRow[]> {
  const db = getDb();
  const records = await db.select().from(productRecords);
  const rows = await db.select({ v: productVariants, stock: inventory }).from(productVariants).leftJoin(inventory, eq(inventory.variantId, productVariants.id));
  const byProduct = new Map<string, typeof rows>();
  for (const row of rows) byProduct.set(row.v.productId, [...(byProduct.get(row.v.productId) ?? []), row]);
  const now = new Date();
  return records
    .map((r) => {
      const variants = (byProduct.get(r.id) ?? []).filter(({ v }) => v.status === "publish");
      const prices = variants
        .map(({ v }) => (v.salePriceMinor !== null && (!v.saleFrom || v.saleFrom <= now) && (!v.saleTo || v.saleTo > now) ? v.salePriceMinor : v.regularPriceMinor))
        .filter((p) => p > 0n);
      const statuses = new Set(variants.map(({ stock }) => (stock?.manageStock ? ((stock.stockQuantity ?? 0) > 0 ? "instock" : stock.backorders === "no" ? "outofstock" : "onbackorder") : (stock?.stockStatus ?? "instock"))));
      const quantities = variants.filter(({ stock }) => stock?.manageStock).map(({ stock }) => stock!.stockQuantity ?? 0);
      const label = statuses.has("instock") ? "In stock" : statuses.has("onbackorder") ? "On backorder" : "Out of stock";
      return {
        shopId: r.shopId,
        name: r.name,
        slug: r.slug,
        status: r.status,
        type: r.type,
        categorySlugs: r.categorySlugs,
        priceMin: prices.length ? toRupiah(prices.reduce((a, b) => (b < a ? b : a))) : null,
        priceMax: prices.length ? toRupiah(prices.reduce((a, b) => (b > a ? b : a))) : null,
        stock: quantities.length ? `${label} (${quantities.reduce((a, b) => a + b, 0)})` : label,
        variants: variants.length,
        onSale: variants.some(({ v }) => v.salePriceMinor !== null),
        updatedAt: r.updatedAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}
