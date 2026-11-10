/**
 * The structured data (JSON-LD) the live site prints on a page: Yoast SEO's graph (WebPage,
 * BreadcrumbList, WebSite, Organization …) and the owner's own blocks (Product, FAQPage, …), from
 * the snapshot src/content/seo/jsonld.json (scripts/audit/export_jsonld.py; the blog author's
 * e-mail name is replaced there, R-12). Addresses point to this site's own domain; pictures keep
 * the live site's address until Phase 4 moves them (same paths). Phase 4 builds these from Sanity.
 *
 * `path`: the page's address as the live site's inventory lists it, e.g. "/bpc-157-bali/". A page
 * without a snapshot prints nothing.
 */
import "server-only";

import data from "@/content/seo/jsonld.json";
import { siteUrl } from "@/lib/site";

type Block = { yoast: boolean; data: unknown };
const snapshot = data as Record<string, Block[]>;
const site = siteUrl.replace(/\/$/, "");

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

export function JsonLd({ path }: { path: string }) {
  const blocks = snapshot[path];
  if (!blocks) return null;
  return blocks.map((block, index) => (
    <script key={index} type="application/ld+json" className={block.yoast ? "yoast-schema-graph" : undefined} dangerouslySetInnerHTML={{ __html: serialise(block.data) }} />
  ));
}
