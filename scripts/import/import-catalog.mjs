#!/usr/bin/env node
// Puts the live shop's 182 products, their 319 variations, prices and stock status into the store
// database (product_records, product_variants, inventory), and its 25 categories and 4 shop-wide
// attributes (product_categories, product_attributes), from the snapshot in src/content/. From then on
// they are edited in the store admin (/admin/products/, /admin/categories/, /admin/attributes/).
//
//   node scripts/import/import-catalog.mjs             # adds what isn't there yet (admin edits are kept)
//   node scripts/import/import-catalog.mjs --overwrite # puts the snapshot's values back (loses edits!)
//   node scripts/import/import-catalog.mjs --dry-run   # only counts
//
// Database: DATABASE_URL_UNPOOLED / DATABASE_URL from .env.local, or the local .data/pglite when empty.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { attributeRows, catalogRows, categoryRows } from "./catalog-mapping.mjs";
import { openDatabase } from "./database.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
const args = new Set(process.argv.slice(2));
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const rows = catalogRows(read("src/content/catalog.json"), read("src/content/product-pages.json"), read("src/content/stock-status.json"));
const variantCount = rows.reduce((n, r) => n + r.variants.length, 0);
console.log(`${rows.length} products, ${variantCount} variants (${rows.filter((r) => r.record.type === "variable").length} variable products).`);
if (args.has("--dry-run")) process.exit(0);

const overwrite = args.has("--overwrite");
const db = await openDatabase();
console.log(`Database: ${db.where}`);
let added = 0;
let kept = 0;
await db.run(async (query) => {
  for (const { record, variants } of rows) {
    const existing = await query("select id from product_records where shop_id = $1", [record.shopId]);
    let productId = existing[0]?.id;
    if (productId && !overwrite) {
      kept++;
      continue;
    }
    const values = [record.sanityId, record.legacyWcProductId, record.shopId, record.slug, record.name, record.type, record.status, record.categorySlugs, record.menuOrder, record.publishedAt, JSON.stringify(record.attributes)];
    if (productId) {
      await query(
        `update product_records set sanity_id = $1, legacy_wc_product_id = $2, slug = $4, name = $5, type = $6, status = $7, category_slugs = $8, menu_order = $9, published_at = $10, attributes = $11::text::jsonb, updated_at = now() where shop_id = $3`,
        values,
      );
    } else {
      [{ id: productId }] = await query(
        `insert into product_records (sanity_id, legacy_wc_product_id, shop_id, slug, name, type, status, category_slugs, menu_order, published_at, attributes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb) returning id`,
        values,
      );
    }
    for (const variant of variants) {
      const [{ id: variantId }] = await query(
        `insert into product_variants (product_id, legacy_wc_variation_id, variant_key, shop_id, attributes, image, price_minor, regular_price_minor, sort_order)
         values ($1, $2, $3, $4, $5::text::jsonb, $6::text::jsonb, $7, $8, $9)
         on conflict (product_id, variant_key) do update set legacy_wc_variation_id = excluded.legacy_wc_variation_id, shop_id = excluded.shop_id, attributes = excluded.attributes,
           image = excluded.image, price_minor = excluded.price_minor, regular_price_minor = excluded.regular_price_minor, sale_price_minor = null, sort_order = excluded.sort_order, updated_at = now()
         returning id`,
        [productId, variant.legacyWcVariationId, variant.variantKey, variant.shopId, JSON.stringify(variant.attributes), variant.image ? JSON.stringify(variant.image) : null, String(variant.priceMinor), String(variant.regularPriceMinor), variant.sortOrder],
      );
      await query(
        `insert into inventory (variant_id, manage_stock, stock_status, backorders) values ($1, false, $2, $3)
         on conflict (variant_id) do update set stock_status = excluded.stock_status, backorders = excluded.backorders, updated_at = now()`,
        [variantId, variant.inventory.stockStatus, variant.inventory.backorders],
      );
    }
    added++;
  }
});
// The categories and shop-wide attributes (edited in /admin/categories/ and /admin/attributes/).
const categories = categoryRows(read("src/content/catalog.json"));
const attributes = attributeRows(read("src/content/catalog.json"), read("src/content/product-pages.json"));
let taxonomyAdded = 0;
await db.run(async (query) => {
  for (const c of categories) {
    const values = [c.id, c.slug, c.name, c.parentId, c.title, c.sortOrder, c.tileImage ? JSON.stringify(c.tileImage) : null, c.searchImage ? JSON.stringify(c.searchImage) : null, JSON.stringify(c.seo)];
    const written = await query(
      `insert into product_categories (id, slug, name, parent_id, title, sort_order, tile_image, search_image, seo)
       values ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8::text::jsonb, $9::text::jsonb)
       on conflict (id) do ${overwrite ? "update set slug = excluded.slug, name = excluded.name, parent_id = excluded.parent_id, title = excluded.title, sort_order = excluded.sort_order, tile_image = excluded.tile_image, search_image = excluded.search_image, seo = excluded.seo, updated_at = now()" : "nothing"}
       returning id`,
      values,
    );
    taxonomyAdded += written.length;
  }
  for (const a of attributes) {
    const written = await query(
      `insert into product_attributes (slug, label, swatches, terms) values ($1, $2, $3, $4::text::jsonb)
       on conflict (slug) do ${overwrite ? "update set label = excluded.label, swatches = excluded.swatches, terms = excluded.terms, updated_at = now()" : "nothing"}
       returning slug`,
      [a.slug, a.label, a.swatches, JSON.stringify(a.terms)],
    );
    taxonomyAdded += written.length;
  }
});
const [{ products, variants, cats, attrs }] = await db.query(
  "select (select count(*)::int from product_records) as products, (select count(*)::int from product_variants) as variants, (select count(*)::int from product_categories) as cats, (select count(*)::int from product_attributes) as attrs",
);
await db.close();
console.log(`Done: ${added} ${overwrite ? "written" : "added"}, ${kept} already there (kept). The database now has ${products} products and ${variants} variants.`);
console.log(`Categories and attributes: ${taxonomyAdded} ${overwrite ? "written" : "added"}; the database now has ${cats} categories and ${attrs} attributes.`);
