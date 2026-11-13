/**
 * Catalogue tables: the SELLABLE side of products.
 *
 * Product content (names, descriptions, images, SEO) lives in Sanity. Postgres only knows what
 * is needed to sell safely: which variants exist, their prices and their stock.
 * See docs/architecture/database-schema.md §2 and system-architecture.md §2.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const productType = pgEnum("product_type", ["simple", "variable"]);
export const recordStatus = pgEnum("record_status", ["draft", "publish", "private", "archived"]);
export const stockStatus = pgEnum("stock_status", ["instock", "outofstock", "onbackorder"]);
export const backorderPolicy = pgEnum("backorder_policy", ["no", "notify", "yes"]);
export const inventoryReason = pgEnum("inventory_reason", ["order", "refund", "cancellation", "manual", "migration"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Numbers for products and variations made in the store admin (/admin/products/). The shop, the cart
 * and the orders know products by number, like WooCommerce; migrated ones keep their WooCommerce
 * number, new ones count from 200000 so they never meet one.
 */
export const shopIdSeq = pgSequence("shop_id_seq", { startWith: 200000 });

/** An attribute a variable product's variations differ by, e.g. MG (10, 20) or Pen Type. */
export type ProductAttribute = {
  /** Form field name, e.g. "attribute_pa_mg" (variations use it as their key). */
  name: string;
  label: string;
  /** Shown as pill swatches (true) or a dropdown (false). */
  swatches: boolean;
  options: { value: string; label: string }[];
  /** Option chosen when the product page opens (WooCommerce "default attributes"). */
  default: string | null;
};

/** A variation's picture (the one the product page shows first when it is chosen). */
export type VariantImage = { src: string; srcset: string | null; sizes: string | null; alt: string; width?: number; height?: number };

/** A picture as the shop shows it (a category's round tile, its search suggestion thumbnail). */
export type CatalogPicture = { src: string; width: number; height: number; alt: string; srcset?: string; sizes?: string };

/** Yoast's tags of a page, as copied from the live site (src/lib/catalog/types.ts PageSeo). */
export type CategorySeo = { title: string; description: string | null; robots?: string | null; ogType: string | null; ogTitle: string | null; ogDescription: string | null };

/** Numbers for categories made in the store admin; migrated ones keep their WooCommerce term id. */
export const categoryIdSeq = pgSequence("category_id_seq", { startWith: 300000 });

/**
 * The shop's product categories (WooCommerce's product_cat), edited in /admin/categories/. Products
 * name theirs by slug (product_records.category_slugs); the address is the parents' slugs and its own
 * (/product-category/vial/healing-recovery/). How many products each has is counted from the products.
 */
export const productCategories = pgTable(
  "product_categories",
  {
    id: integer("id").primaryKey().default(sql`nextval('category_id_seq')`),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** 0 for a top-level category. */
    parentId: integer("parent_id").notNull().default(0),
    /** The category page's heading (the live site shows the name). */
    title: text("title").notNull(),
    /** Position among its siblings in the round-picture carousels (the shop's for top-level ones). */
    sortOrder: integer("sort_order").notNull().default(0),
    /** Its round picture in the parent's (or the shop's) carousel. */
    tileImage: jsonb("tile_image").$type<CatalogPicture>(),
    /** Its thumbnail in the header search suggestions (none on live for most). */
    searchImage: jsonb("search_image").$type<CatalogPicture>(),
    seo: jsonb("seo").$type<CategorySeo>().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("product_categories_slug_key").on(table.slug), index("product_categories_parent_idx").on(table.parentId)],
);

/** A value of a shop-wide attribute, e.g. { value: "10", label: "10 MG" } of MG. */
export type AttributeTerm = { value: string; label: string };

/**
 * The shop-wide attributes (WooCommerce's pa_* taxonomies: MG, Pen Type, IU, Storage), edited in
 * /admin/attributes/. A product using one stores it as attribute_pa_<slug> with the values it uses;
 * the shop shows the attribute's current name, display (pills or dropdown) and value names and order.
 */
export const productAttributes = pgTable("product_attributes", {
  /** "mg": the products' form field is attribute_pa_mg. */
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  /** Shown as pill swatches (true) or a dropdown (false). */
  swatches: boolean("swatches").notNull().default(false),
  /** Every value, in the order the shop lists them (WooCommerce's "custom ordering"). */
  terms: jsonb("terms").$type<AttributeTerm[]>().notNull().default(sql`'[]'::jsonb`),
  ...timestamps,
});

/**
 * One row per product. The store admin (/admin/products/) creates, edits, archives and deletes
 * products here; Sanity holds their texts and pictures (document `sanityId`, kept in step).
 */
export const productRecords = pgTable(
  "product_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sanityId: text("sanity_id").notNull(),
    legacyWcProductId: integer("legacy_wc_product_id"),
    /** The product's number in the shop, cart and orders (= its WooCommerce id when migrated). */
    shopId: integer("shop_id").notNull().default(sql`nextval('shop_id_seq')`),
    slug: text("slug").notNull(),
    /**
     * The addresses this product had before its slug was changed in /admin/products/ (WordPress's
     * _wp_old_slug): /product/<old>/ answers 301 to the current address (src/proxy.ts), unless another
     * product uses that address now. The live site's own history is src/content/seo/old-slug-redirects.json.
     */
    oldSlugs: text("old_slugs").array().notNull().default(sql`'{}'::text[]`),
    name: text("name").notNull(),
    type: productType("type").notNull(),
    status: recordStatus("status").notNull().default("draft"),
    /** What the status was before the product was archived (restoring brings it back). */
    statusBeforeArchive: recordStatus("status_before_archive"),
    /** Category slugs (src/content/catalog.json categories). */
    categorySlugs: text("category_slugs").array().notNull().default(sql`'{}'::text[]`),
    /** Position in the shop's default order ("Sort by popularity"); lower first. */
    menuOrder: integer("menu_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attributes: jsonb("attributes").$type<ProductAttribute[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_records_sanity_id_key").on(table.sanityId),
    uniqueIndex("product_records_legacy_wc_product_id_key").on(table.legacyWcProductId),
    uniqueIndex("product_records_shop_id_key").on(table.shopId),
    uniqueIndex("product_records_slug_key").on(table.slug),
  ],
);

/** What a customer actually buys. A simple product has exactly one variant. */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productRecords.id, { onDelete: "restrict" }),
    legacyWcVariationId: integer("legacy_wc_variation_id"),
    /** Stable key built from attribute slugs, e.g. "pen-type=disposable-pen;mg=5" ("default" for simple products). */
    variantKey: text("variant_key").notNull(),
    /** The variation's number in the shop and cart (= its WooCommerce id when migrated); null for a
     * simple product's only variant (the cart knows it by the product's number). */
    shopId: integer("shop_id"),
    /** e.g. { "attribute_pa_mg": "10" }; "" means "any". Empty for a simple product. */
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    image: jsonb("image").$type<VariantImage | null>(),
    sku: text("sku"),
    currency: char("currency", { length: 3 }).notNull().default("IDR"),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    regularPriceMinor: bigint("regular_price_minor", { mode: "bigint" }).notNull(),
    salePriceMinor: bigint("sale_price_minor", { mode: "bigint" }),
    saleFrom: timestamp("sale_from", { withTimezone: true }),
    saleTo: timestamp("sale_to", { withTimezone: true }),
    status: recordStatus("status").notNull().default("publish"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_variants_product_key").on(table.productId, table.variantKey),
    uniqueIndex("product_variants_legacy_wc_variation_id_key").on(table.legacyWcVariationId),
    uniqueIndex("product_variants_sku_key").on(table.sku),
    uniqueIndex("product_variants_shop_id_key").on(table.shopId),
    check("product_variants_price_not_negative", sql`${table.priceMinor} >= 0 AND ${table.regularPriceMinor} >= 0`),
  ],
);

/** Current stock for each variant (mirrors WooCommerce's stock settings). */
export const inventory = pgTable(
  "inventory",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    manageStock: boolean("manage_stock").notNull().default(false),
    stockQuantity: integer("stock_quantity"),
    stockStatus: stockStatus("stock_status").notNull().default("instock"),
    backorders: backorderPolicy("backorders").notNull().default("no"),
    updatedAt: timestamps.updatedAt,
  },
);

/** Append-only history of every stock change. Never update or delete rows here. */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    reason: inventoryReason("reason").notNull(),
    /** Filled once the orders table exists (Phase 5). */
    orderId: uuid("order_id"),
    actorUserId: text("actor_user_id"),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("inventory_movements_variant_idx").on(table.variantId)],
);
