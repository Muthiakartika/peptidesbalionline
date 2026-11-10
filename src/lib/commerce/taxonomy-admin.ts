/**
 * The store admin's categories (/admin/categories/) and shop-wide attributes (/admin/attributes/):
 * WooCommerce → Products → Categories and → Attributes.
 *
 * Rules (what keeps products, coupons and old links whole):
 *   * a category's address (slug) is chosen when it is made and doesn't change: products and coupons
 *     name their categories by it. Its name, page heading, parent, carousel position, picture and SEO
 *     tags can change; the shop shows the change everywhere at once (src/lib/catalog/build.ts);
 *   * a category can be deleted only when no product (in any status, archived ones too) and no coupon
 *     uses it and it has no sub-categories;
 *   * an attribute's values keep their value (variations store it); their names and order can change;
 *     a value (or the attribute) can be removed only when no product uses it;
 *   * the SEO title, description and heading that still have their automatic value (made from the
 *     name, as on live: "<name> in Bali - Atlas Longevity") follow a new name.
 */
import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { coupons, productAttributes, productCategories, productRecords, productVariants, type CatalogPicture, type CategorySeo } from "@/db/schema";
import { categoriesFrom, familySlugs, type DbCategoryRow } from "@/lib/catalog/build";

import { shopAttributeName, slugify } from "./slug";

export type TaxonomyResult = { ok: true; id: string; warning?: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

/** Yoast's title and description of a category on live (every one but Peptide Blends Bali). */
export const defaultCategorySeoTitle = (name: string) => `${name} in Bali - Atlas Longevity`;
export const defaultCategorySeoDescription = (name: string) => `Shop ${name} at Atlas Longevity in Bali: lab-tested research peptides with discreet packaging and fast delivery across Bali.`;
const ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

/** Category addresses that would clash with the shop's own (/product-category/…/page/2/, …/view/…: src/proxy.ts). */
const RESERVED_SLUGS = new Set(["page", "view", "feed", "embed"]);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "The category needs a name").max(200),
  slug: z.string().trim().max(190),
  parentId: z.number().int().min(0),
  title: z.string().trim().max(200),
  sortOrder: z.number().int().min(-100000).max(100000),
  picture: z.string().trim().max(2000),
  seoTitle: z.string().trim().max(300),
  seoDescription: z.string().trim().max(1000),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export type AdminCategory = DbCategoryRow & { path: string; depth: number; products: number; listed: number; children: number };

async function categoryRows(): Promise<DbCategoryRow[]> {
  const rows = await getDb().select().from(productCategories).orderBy(asc(productCategories.id));
  return rows.map(({ id, slug, name, parentId, title, sortOrder, tileImage, searchImage, seo }) => ({ id, slug, name, parentId, title, sortOrder, tileImage, searchImage, seo }));
}

/** How many products (any status) name each category slug directly. */
async function productsBySlug(): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ slug: sql<string>`unnest(${productRecords.categorySlugs})`, n: sql<number>`count(*)::int` })
    .from(productRecords)
    .groupBy(sql`1`);
  return new Map(rows.map((r) => [r.slug, r.n]));
}

/** Every category as a tree (parents first, siblings in carousel order), with its product numbers. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const rows = await categoryRows();
  const direct = await productsBySlug();
  const { categories } = categoriesFrom(rows);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const published = await getDb().select({ slugs: productRecords.categorySlugs }).from(productRecords).where(eq(productRecords.status, "publish"));
  const out: AdminCategory[] = [];
  const walk = (parent: number, depth: number) => {
    for (const row of rows.filter((r) => (byId.get(r.id)?.parent ?? 0) === parent && r.id !== parent).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en"))) {
      const category = byId.get(row.id)!;
      const family = familySlugs(category, categories);
      out.push({
        ...row,
        path: category.path,
        depth,
        products: direct.get(row.slug) ?? 0,
        listed: published.filter((p) => p.slugs.some((s) => family.has(s))).length,
        children: categories.filter((c) => c.parent === row.id).length,
      });
      walk(row.id, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}

export async function getEditorCategory(id: number): Promise<AdminCategory | null> {
  return (await listAdminCategories()).find((c) => c.id === id) ?? null;
}

/** The ids of a category and everything below it (a category can't move under its own sub-category). */
function descendantsOf(id: number, rows: DbCategoryRow[]): Set<number> {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) {
      if (!ids.has(r.id) && ids.has(r.parentId)) {
        ids.add(r.id);
        grew = true;
      }
    }
  }
  return ids;
}

function picture(url: string, name: string, previous: CatalogPicture | null): CatalogPicture | null {
  if (!url) return null;
  if (previous && previous.src === url) return { ...previous, alt: previous.alt || name };
  if (!/^(https?:\/\/|\/)[^\s"'<>]+$/.test(url)) throw new Error("bad-picture");
  // The carousel shows tiles at this size (as the live tiles), whatever the file's own size.
  return { src: url, width: 300, height: 300, alt: name };
}

/** Checks the form; an error in the admin's words, or the cleaned values. */
export async function cleanCategoryInput(raw: unknown, existing: DbCategoryRow | null): Promise<string | (Omit<DbCategoryRow, "id"> & { id?: number })> {
  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Please check the form.";
  const input = parsed.data;
  const rows = await categoryRows();
  const slug = existing ? existing.slug : slugify(input.slug || input.name);
  if (!slug) return "The address (slug) needs letters or numbers.";
  if (!existing && RESERVED_SLUGS.has(slug)) return `"${slug}" can't be a category address. Please choose another one.`;
  if (!existing && rows.some((r) => r.slug === slug)) return `The address ${slug} is already used by another category.`;
  if (input.parentId !== 0) {
    if (!rows.some((r) => r.id === input.parentId)) return "The parent category doesn't exist any more.";
    if (existing && descendantsOf(existing.id, rows).has(input.parentId)) return "A category can't be placed under itself or one of its sub-categories.";
  }
  let tile: CatalogPicture | null;
  try {
    tile = picture(input.picture, input.name, existing?.tileImage ?? null);
  } catch {
    return "The picture must be an address starting with https:// (copy it from the media library).";
  }

  // Values still made from the old name follow the new name (as on live, where Yoast builds them).
  const oldName = existing?.name;
  const follows = (value: string, made: (name: string) => string) => (!value || (oldName !== undefined && value === made(oldName)) ? made(input.name) : value);
  const sameName = (name: string) => name;
  const title = existing ? follows(input.title || existing.title, sameName) : input.title || input.name;
  const seoTitle = follows(input.seoTitle, defaultCategorySeoTitle);
  const seoDescription = follows(input.seoDescription, defaultCategorySeoDescription);
  const was = existing?.seo;
  const seo: CategorySeo = {
    title: seoTitle,
    description: seoDescription,
    robots: was?.robots ?? ROBOTS,
    ogType: was?.ogType ?? "article",
    // Open Graph followed the SEO title and description on live; keep it so.
    ogTitle: !was || was.ogTitle === was.title ? seoTitle : was.ogTitle,
    ogDescription: !was || was.ogDescription === was.description ? seoDescription : was.ogDescription,
  };
  return {
    slug,
    name: input.name,
    parentId: input.parentId,
    title,
    sortOrder: input.sortOrder,
    tileImage: tile,
    // The header search shows a thumbnail only for the categories live shows one for: those keep it
    // (the new picture when it changes); others, and new categories, show none, as most on live.
    searchImage: tile && existing?.searchImage ? (tile.src === existing.tileImage?.src ? existing.searchImage : { ...tile }) : null,
    seo,
  };
}

export async function createCategory(raw: unknown): Promise<TaxonomyResult> {
  const clean = await cleanCategoryInput(raw, null);
  if (typeof clean === "string") return { ok: false, error: clean };
  const [row] = await getDb().insert(productCategories).values(clean).returning({ id: productCategories.id });
  return { ok: true, id: String(row.id) };
}

export async function updateCategory(id: number, raw: unknown): Promise<TaxonomyResult> {
  const existing = (await categoryRows()).find((r) => r.id === id);
  if (!existing) return { ok: false, error: "This category doesn't exist any more." };
  const clean = await cleanCategoryInput(raw, existing);
  if (typeof clean === "string") return { ok: false, error: clean };
  await getDb()
    .update(productCategories)
    .set({ name: clean.name, parentId: clean.parentId, title: clean.title, sortOrder: clean.sortOrder, tileImage: clean.tileImage, searchImage: clean.searchImage, seo: clean.seo, updatedAt: new Date() })
    .where(eq(productCategories.id, id));
  return { ok: true, id: String(id) };
}

/** What still uses a category (why it can't be deleted), in the admin's words; null when nothing does. */
export async function categoryInUse(id: number): Promise<string | null> {
  const rows = await categoryRows();
  const row = rows.find((r) => r.id === id);
  if (!row) return "This category doesn't exist any more.";
  const children = rows.filter((r) => r.parentId === id);
  if (children.length) return `It has sub-categories (${children.map((c) => c.name).join(", ")}): move or delete them first.`;
  const products = await getDb()
    .select({ name: productRecords.name })
    .from(productRecords)
    .where(sql`${row.slug} = any(${productRecords.categorySlugs})`);
  if (products.length) return `${products.length} product${products.length === 1 ? " is" : "s are"} in it (${products.slice(0, 3).map((p) => p.name).join(", ")}${products.length > 3 ? ", …" : ""}): move ${products.length === 1 ? "it" : "them"} to another category first (archived products count too).`;
  const used = await getDb()
    .select({ code: coupons.code })
    .from(coupons)
    .where(sql`${row.slug} = any(${coupons.categorySlugs}) or ${row.slug} = any(${coupons.excludedCategorySlugs})`);
  if (used.length) return `Coupon${used.length === 1 ? "" : "s"} ${used.map((c) => `"${c.code}"`).join(", ")} name${used.length === 1 ? "s" : ""} this category: change ${used.length === 1 ? "it" : "them"} first.`;
  return null;
}

export async function deleteCategory(id: number): Promise<TaxonomyResult> {
  const reason = await categoryInUse(id);
  if (reason) return { ok: false, error: `This category can't be deleted. ${reason}` };
  await getDb().delete(productCategories).where(eq(productCategories.id, id));
  return { ok: true, id: String(id) };
}

// ---------------------------------------------------------------------------------------------
// Shop-wide attributes
// ---------------------------------------------------------------------------------------------

export const attributeInputSchema = z.object({
  label: z.string().trim().min(1, "The attribute needs a name").max(60),
  slug: z.string().trim().max(28),
  swatches: z.boolean(),
  terms: z.array(z.object({ value: z.string().trim().max(190).optional(), label: z.string().trim().min(1, "Every value needs a name").max(60) })).max(200),
});
export type AttributeInput = z.infer<typeof attributeInputSchema>;

export type AdminAttribute = { slug: string; label: string; swatches: boolean; terms: { value: string; label: string; products: number }[]; products: number };

/** Every product's attributes and its variations' values, for "what uses this attribute / value". */
async function attributeUse() {
  const db = getDb();
  const [records, variants] = await Promise.all([
    db.select({ id: productRecords.id, name: productRecords.name, attributes: productRecords.attributes }).from(productRecords),
    db.select({ productId: productVariants.productId, attributes: productVariants.attributes }).from(productVariants),
  ]);
  /** Products using the attribute (by field name), and per value the products using it. */
  const products = (field: string) => records.filter((r) => r.attributes.some((a) => a.name === field));
  const valueUsers = (field: string, value: string) => {
    const ids = new Set(variants.filter((v) => v.attributes[field] === value).map((v) => v.productId));
    for (const r of records) if (r.attributes.some((a) => a.name === field && a.options.some((o) => o.value === value))) ids.add(r.id);
    return records.filter((r) => ids.has(r.id));
  };
  return { products, valueUsers };
}

export async function listAdminAttributes(): Promise<AdminAttribute[]> {
  const rows = await getDb().select().from(productAttributes).orderBy(asc(productAttributes.label));
  const use = await attributeUse();
  return rows.map((a) => ({
    slug: a.slug,
    label: a.label,
    swatches: a.swatches,
    products: use.products(shopAttributeName(a.slug)).length,
    terms: a.terms.map((t) => ({ ...t, products: use.valueUsers(shopAttributeName(a.slug), t.value).length })),
  }));
}

/** The shop-wide attributes for the product form (name, display, values in order). */
export async function listShopAttributes(): Promise<{ slug: string; label: string; swatches: boolean; terms: { value: string; label: string }[] }[]> {
  const rows = await getDb().select().from(productAttributes).orderBy(asc(productAttributes.label));
  return rows.map(({ slug, label, swatches, terms }) => ({ slug, label, swatches, terms }));
}

export async function getEditorAttribute(slug: string): Promise<AdminAttribute | null> {
  return (await listAdminAttributes()).find((a) => a.slug === slug) ?? null;
}

async function cleanAttributeInput(raw: unknown, existing: { slug: string; terms: { value: string; label: string }[] } | null) {
  const parsed = attributeInputSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Please check the form.";
  const input = parsed.data;
  const slug = existing ? existing.slug : slugify(input.slug || input.label);
  if (!slug) return "The attribute's slug needs letters or numbers.";
  if (!existing) {
    const [taken] = await getDb().select({ slug: productAttributes.slug }).from(productAttributes).where(eq(productAttributes.slug, slug));
    if (taken) return `An attribute with the slug ${slug} already exists.`;
  }
  const known = new Set(existing?.terms.map((t) => t.value) ?? []);
  const terms = input.terms.map((t) => ({ value: t.value && known.has(t.value) ? t.value : slugify(t.label), label: t.label }));
  if (terms.some((t) => !t.value)) return "Every value's name needs letters or numbers.";
  const seen = new Set<string>();
  for (const t of terms) {
    if (seen.has(t.value)) return `"${t.label}" is there twice.`;
    seen.add(t.value);
  }
  if (existing) {
    const removed = existing.terms.filter((t) => !seen.has(t.value));
    if (removed.length) {
      const use = await attributeUse();
      for (const t of removed) {
        const users = use.valueUsers(shopAttributeName(slug), t.value);
        if (users.length) return `"${t.label}" is used by ${users.length} product${users.length === 1 ? "" : "s"} (${users.slice(0, 3).map((u) => u.name).join(", ")}${users.length > 3 ? ", …" : ""}): remove it from ${users.length === 1 ? "that product" : "those products"} first.`;
      }
    }
  }
  return { slug, label: input.label, swatches: input.swatches, terms };
}

export async function createAttribute(raw: unknown): Promise<TaxonomyResult> {
  const clean = await cleanAttributeInput(raw, null);
  if (typeof clean === "string") return { ok: false, error: clean };
  await getDb().insert(productAttributes).values(clean);
  return { ok: true, id: clean.slug };
}

export async function updateAttribute(slug: string, raw: unknown): Promise<TaxonomyResult> {
  const [existing] = await getDb().select().from(productAttributes).where(eq(productAttributes.slug, slug));
  if (!existing) return { ok: false, error: "This attribute doesn't exist any more." };
  const clean = await cleanAttributeInput(raw, existing);
  if (typeof clean === "string") return { ok: false, error: clean };
  await getDb().update(productAttributes).set({ label: clean.label, swatches: clean.swatches, terms: clean.terms, updatedAt: new Date() }).where(eq(productAttributes.slug, slug));
  return { ok: true, id: slug };
}

export async function deleteAttribute(slug: string): Promise<TaxonomyResult> {
  const use = await attributeUse();
  const users = use.products(shopAttributeName(slug));
  if (users.length) return { ok: false, error: `This attribute can't be deleted: ${users.length} product${users.length === 1 ? " uses" : "s use"} it (${users.slice(0, 3).map((u) => u.name).join(", ")}${users.length > 3 ? ", …" : ""}).` };
  await getDb().delete(productAttributes).where(eq(productAttributes.slug, slug));
  return { ok: true, id: slug };
}
