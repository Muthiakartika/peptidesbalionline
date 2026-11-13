/**
 * The XML sitemaps (src/lib/seo/sitemaps.ts) against the live snapshot of 5 Nov 2026: the same five
 * parts and counts as Yoast's, valid XML entries, and every address one the rebuild serves.
 */
import { describe, expect, it } from "vitest";

import { blogArchivePaths, blogPostSlugs } from "@/content/blog";
import { elementorPageNames } from "@/content/pages";
import { getAllProducts, getCategories } from "@/lib/catalog";

import { productCategorySitemapEntries, productSitemapEntries, SITEMAP_NAMES, sitemapDate, sitemapEntries, sitemapIndexXml, sitemapXml } from "./sitemaps";

describe("the shop's sitemaps follow the catalogue", () => {
  const snapshot = [
    { path: "/shop/", lastmod: "2026-11-04T13:14:45+00:00", images: [] },
    { path: "/product/old/", lastmod: "2026-08-01T10:00:00+00:00", images: ["https://peptidesbali.online/wp-content/uploads/old.webp"] },
    { path: "/product/archived/", lastmod: "2026-09-01T10:00:00+00:00", images: [] },
  ];
  const products = [
    { path: "/product/new/", date: "2026-11-12T08:30:00", image: "https://media.example.com/new.webp", categories: ["vial"] },
    { path: "/product/old/", date: "2026-01-01T00:00:00", image: null, categories: ["pens"] },
  ];

  it("lists /shop/ first, then the products from the oldest change; new ones dated by publication; archived ones gone", () => {
    expect(productSitemapEntries(products, snapshot)).toEqual([
      { path: "/shop/", lastmod: "2026-11-12T08:30:00+00:00", images: [] },
      snapshot[1],
      { path: "/product/new/", lastmod: "2026-11-12T08:30:00+00:00", images: ["https://media.example.com/new.webp"] },
    ]);
  });

  it("lists the categories that have products, new ones dated by their newest product", () => {
    const entries = productSitemapEntries(products, snapshot);
    const categories = [
      { id: 1, parent: 0, slug: "vial", path: "/product-category/vial/", count: 1 },
      { id: 2, parent: 0, slug: "pens", path: "/product-category/pens/", count: 1 },
      { id: 3, parent: 0, slug: "empty", path: "/product-category/empty/", count: 0 },
    ];
    const known = [{ path: "/product-category/pens/", lastmod: "2026-10-01T00:00:00+00:00", images: [] }];
    expect(productCategorySitemapEntries(categories, entries, products, known)).toEqual([known[0], { path: "/product-category/vial/", lastmod: "2026-11-12T08:30:00+00:00", images: [] }]);
  });

  it("writes dates as Yoast does", () => {
    expect(sitemapDate("2026-11-12T08:30:00")).toBe("2026-11-12T08:30:00+00:00");
    expect(sitemapDate(new Date("2026-11-12T08:30:00.123Z"))).toBe("2026-11-12T08:30:00+00:00");
    expect(sitemapIndexXml({ product: productSitemapEntries(products, snapshot) })).toMatch(/\/product-sitemap\.xml<\/loc>\n\t\t<lastmod>2026-11-12T08:30:00\+00:00<\/lastmod>/);
  });
});

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
