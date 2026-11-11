/**
 * The XML sitemaps (src/lib/seo/sitemaps.ts) against the live snapshot of 5 Nov 2026: the same five
 * parts and counts as Yoast's, valid XML entries, and every address one the rebuild serves.
 */
import { describe, expect, it } from "vitest";

import { blogArchivePaths, blogPostSlugs } from "@/content/blog";
import { elementorPageNames } from "@/content/pages";
import { getAllProducts, getCategories } from "@/lib/catalog";

import { SITEMAP_NAMES, sitemapEntries, sitemapIndexXml, sitemapXml } from "./sitemaps";

describe("sitemaps", () => {
  it("has Yoast's five parts with the live counts", () => {
    expect(SITEMAP_NAMES).toEqual(["post", "page", "product", "category", "product_cat"]);
    expect(SITEMAP_NAMES.map((name) => sitemapEntries(name).length)).toEqual([54, 74, 183, 8, 25]);
    expect(sitemapIndexXml().match(/<sitemap>/g)).toHaveLength(5);
    expect(sitemapIndexXml()).toContain("/product_cat-sitemap.xml</loc>");
  });

  it("prints one <url> per address, with its date and pictures, and escapes the text", () => {
    const xml = sitemapXml("page");
    expect(xml.match(/<url>/g)).toHaveLength(74);
    expect(xml.match(/<image:image>/g)).toHaveLength(sitemapEntries("page").reduce((n, entry) => n + entry.images.length, 0));
    expect(xml).toMatch(/<lastmod>\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00<\/lastmod>/);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("lists only addresses the rebuild serves", async () => {
    // /shop/ and /protocol-builder/ have routes of their own; the other pages come from the page content.
    const pages = new Set(["/shop/", "/protocol-builder/", ...Object.keys(elementorPageNames)]);
    const missing = sitemapEntries("page").map((entry) => entry.path).filter((path) => !pages.has(path));
    expect(missing).toEqual([]);
    const posts = new Set(Object.keys(blogPostSlugs));
    expect(sitemapEntries("post").every((entry) => posts.has(entry.path))).toBe(true);
    const products = new Set(["/shop/", ...(await getAllProducts()).map((product) => product.path)]);
    expect(sitemapEntries("product").filter((entry) => !products.has(entry.path))).toEqual([]);
    const archives = new Set<string>(blogArchivePaths);
    expect(sitemapEntries("category").every((entry) => archives.has(entry.path))).toBe(true);
    const categories = new Set((await getCategories()).map((category) => category.path));
    expect(sitemapEntries("product_cat").filter((entry) => !categories.has(entry.path))).toEqual([]);
  });
});
