/**
 * The structured data (JSON-LD) the live site prints on a page: Yoast SEO's graph (WebPage,
 * BreadcrumbList, WebSite, Organization …) and the owner's own blocks (Product, FAQPage, …), from
 * the snapshot src/content/seo/jsonld.json (scripts/audit/export_jsonld.py; the blog author's
 * e-mail name is replaced there, R-12). Addresses point to this site's own domain; pictures keep
 * the live site's address (same paths; they forward to the R2 bucket).
 *
 * A product page passes its current data: WooCommerce's Product block then gets the product's name and
 * its offers (price, availability) as they are now (src/lib/seo/product-offer.ts), so a change in
 * /admin/products/ shows in the structured data too; a product without a snapshot (made in the admin)
 * gets WooCommerce's Product block built from its data.
 *
 * `path`: the page's address as the live site's inventory lists it, e.g. "/bpc-157-bali/". A page
 * without a snapshot prints nothing (unless it is such a product).
 */
import "server-only";

import data from "@/content/seo/jsonld.json";
import { siteUrl } from "@/lib/site";

type Block = { yoast: boolean; data: unknown };
const snapshot = data as Record<string, Block[]>;
const site = siteUrl.replace(/\/$/, "");

/** What a product page knows now (see the file's comment). */
export type ProductJsonLd = {
  name: string;
  offer: Record<string, unknown> | null;
  /** WooCommerce's Product block for a product the snapshot doesn't have. */
  block: Record<string, unknown>;
};

/** The JSON for a <script> tag: this site's domain instead of the live one (but not for uploaded
 * files), and "<" escaped so no text inside can close the tag. */
function serialise(block: unknown): string {
  return JSON.stringify(block)
    .replace(/https:\/\/peptidesbali\.online(?!\/wp-content\/)/g, site)
    .replace(/</g, "\\u003c");
}

export function hasJsonLd(path: string): boolean {
  return Object.hasOwn(snapshot, path);
}

/**
 * WordPress shows a name with typographic dashes and quotes (wptexturize: "31G - 100 PCS" → "31G – 100 PCS"),
 * but the structured data has the name as typed. Undone to compare the two.
 */
const asTyped = (name: string) => name.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/&amp;|&#0?38;/g, "&");

/** WooCommerce's Product block with the product's current name and offers. */
export function withCurrentProduct(block: unknown, product: ProductJsonLd): unknown {
  if (!block || typeof block !== "object" || (block as { "@type"?: unknown })["@type"] !== "Product") return block;
  // The name as live writes it, unless the product was renamed since (then the new name).
  const copied = (block as { name?: unknown }).name;
  const name = typeof copied === "string" && asTyped(copied) === asTyped(product.name) ? copied : product.name;
  // Same key order as WooCommerce's: name keeps its place, offers stay last.
  const current: Record<string, unknown> = { ...(block as Record<string, unknown>), name };
  delete current.offers;
  if (product.offer) current.offers = [product.offer];
  return current;
}

export function JsonLd({ path, product }: { path: string; product?: ProductJsonLd }) {
  const blocks = snapshot[path] ?? (product ? [{ yoast: false, data: product.block }] : null);
  if (!blocks) return null;
  return blocks.map((block, index) => (
    <script
      key={index}
      type="application/ld+json"
      className={block.yoast ? "yoast-schema-graph" : undefined}
      dangerouslySetInnerHTML={{ __html: serialise(product ? withCurrentProduct(block.data, product) : block.data) }}
    />
  ));
}
