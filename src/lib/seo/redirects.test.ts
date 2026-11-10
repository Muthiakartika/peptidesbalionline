/**
 * The live site's old addresses (src/content/seo/redirects.json → next.config.ts redirects): 301s that
 * land on a page in one step and never hide a page of the site.
 */
import { describe, expect, it } from "vitest";

import catalog from "@/content/catalog.json";
import inventory from "../../../docs/audit/data/page-inventory.json";

import { legacyRedirects, legacyRules } from "./redirects";

const LIVE = "https://peptidesbali.online";
const livePages = new Set(inventory.pages.filter((page) => page.status === 200).map((page) => page.url.replace(LIVE, "")));
const liveAddresses = new Set(inventory.pages.map((page) => page.url.replace(LIVE, "")));

describe("legacy redirects", () => {
  const redirects = legacyRedirects();

  it("has the 195 permanent redirects of the live site, each address once, as 301", () => {
    expect(legacyRules).toHaveLength(196);
    expect(redirects).toHaveLength(195);
    expect(new Set(redirects.map((r) => r.source.toLowerCase())).size).toBe(195);
    for (const r of redirects) {
      expect(r.statusCode).toBe(301);
      expect(r.source, r.source).toMatch(/^\/[^?#:*()]*\/$/);
      expect(r.destination, r.source).toMatch(/^\/[^?#]*\/$/);
    }
  });

  it("lands on a page in one step and never replaces a page of the site", () => {
    const sources = new Set(redirects.map((r) => r.source));
    // The one target outside the 3 Nov 2026 crawl: a category's second page (checked against live in the build check).
    const notCrawled = new Set(["/product-category/pen-peptides/atlas-longevity-pen-peptides/page/2/"]);
    for (const r of redirects) {
      expect(sources.has(r.destination), `${r.source} → ${r.destination} is a chain`).toBe(false);
      expect(livePages.has(r.destination) || notCrawled.has(r.destination), `${r.destination} is not a live page`).toBe(true);
      expect(liveAddresses.has(r.source), `${r.source} is a page of the site`).toBe(false);
    }
  });

  it("leaves the 404 rule to the product route (that product doesn't exist)", () => {
    const gone = legacyRules.filter((rule) => rule[2] === 404);
    expect(gone).toEqual([["/product/cagrilintide-semaglutide-blend-10mg-bali/", null, 404]]);
    expect(catalog.products.some((product) => product.slug === "cagrilintide-semaglutide-blend-10mg-bali")).toBe(false);
  });
});
