/**
 * Every page, popup and shared block copied from the live site, converted to Sanity content
 * (scripts/sanity/lib/) and rendered back (./elementor.ts, ./rich-text.ts), must come out as the
 * HTML the live site printed (compared as the browser sees it: ./compare.ts).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildContent } from "../../../../scripts/sanity/lib/documents.mjs";
import type { ElementorDocument, RichText, SharedSection, SharedSectionRef } from "../types";
import { firstDifference } from "./compare";
import { renderDocument } from "./elementor";
import { renderRichText } from "./rich-text";

const root = path.resolve(__dirname, "../../../..");
const content = buildContent(root) as {
  pages: (ElementorDocument & { _id: string; name: string; plain: boolean; body?: RichText; bodyMeta?: string })[];
  shared: (SharedSection & { _id: string })[];
  popups: (ElementorDocument & { _id: string; popupId: number })[];
};
const sharedById = new Map(content.shared.map((doc) => [doc._id, doc]));
const resolve = (ref: SharedSectionRef) => sharedById.get(ref.section?._ref ?? "");

const original = (name: string) => JSON.parse(fs.readFileSync(path.join(root, "src/content/pages", `${name}.json`), "utf8")).html as string;

describe("content round trip", () => {
  it.each(content.pages.map((page) => [page.name, page] as const))("page %s", (name, page) => {
    const html = page.plain ? renderRichText(page.body, page.bodyMeta) : renderDocument(page, resolve);
    expect(firstDifference(original(name), html)).toBeNull();
  });

  it.each(content.popups.map((popup) => [popup.popupId, popup] as const))("popup %s", (id, popup) => {
    const source = JSON.parse(fs.readFileSync(path.join(root, "src/content/popups", `${id}.json`), "utf8")).html as string;
    expect(firstDifference(source, renderDocument(popup))).toBeNull();
  });

  it("the block under Add to cart", () => {
    const source = JSON.parse(fs.readFileSync(path.join(root, "src/content/product-pages.json"), "utf8")).blocks["701"] as string;
    expect(firstDifference(source, renderDocument(sharedById.get("sharedSection-block-701")!))).toBeNull();
  });

  it("finds the sections several pages share", () => {
    const repeated = content.shared.filter((doc) => !doc.docId);
    expect(repeated.length).toBeGreaterThanOrEqual(6);
  });
});

describe("site settings round trip", () => {
  it("header, footer and notices come back as the copy of the live site", async () => {
    const { convertSiteChrome } = await import("../../../../scripts/sanity/lib/documents.mjs");
    const { defaultSiteChrome, siteChromeFrom } = await import("../site-chrome-merge");
    expect(siteChromeFrom(await convertSiteChrome(root))).toEqual(defaultSiteChrome);
  });

  it("an empty Site settings document keeps the defaults", async () => {
    const { defaultSiteChrome, siteChromeFrom } = await import("../site-chrome-merge");
    expect(siteChromeFrom({ announcements: [], footer: { intro: "" } })).toEqual(defaultSiteChrome);
  });
});

describe("divider lines", () => {
  // Every array of blocks in every converted document.
  const blockArrays = (value: unknown): unknown[][] =>
    Array.isArray(value)
      ? [value, ...value.flatMap(blockArrays)]
      : value && typeof value === "object"
        ? Object.values(value).flatMap(blockArrays)
        : [];
  const all = [...content.pages, ...content.shared, ...content.popups, ...(content as unknown as { posts: unknown[]; products: unknown[] }).posts, ...(content as unknown as { products: unknown[] }).products];
  const blocks = blockArrays(all).flat() as { _type?: string; html?: string; attrs?: string }[];

  it("every <hr> is a divider line, not HTML", () => {
    expect(blocks.filter((b) => b._type === "dividerBlock").length).toBeGreaterThan(1000);
    expect(blocks.filter((b) => b._type === "htmlBlock" && /^\s*<hr\b[^>]*>\s*$/.test(b.html ?? ""))).toEqual([]);
  });

  it("drops ChatGPT's position marks, keeps other attributes", () => {
    const dividers = blocks.filter((b) => b._type === "dividerBlock");
    expect(dividers.filter((b) => /data-start|data-end/.test(b.attrs ?? ""))).toEqual([]);
    expect(dividers.some((b) => /"class"/.test(b.attrs ?? ""))).toBe(true);
  });

  it("a divider line added in the Studio is a plain <hr>", () => {
    expect(renderRichText([{ _type: "dividerBlock", _key: "a" }])).toBe("<hr>");
  });
});

describe("Sanity limits", () => {
  // Sanity refuses documents nested deeper than 20 levels.
  const depth = (value: unknown, level = 0): number => (value && typeof value === "object" ? Math.max(level, ...Object.values(value).map((v) => depth(v, level + 1))) : level);
  it("no document is nested deeper than Sanity allows", () => {
    for (const doc of [...content.pages, ...content.shared, ...content.popups]) expect(depth(doc), doc._id).toBeLessThan(19);
  });
});

describe("blog posts round trip", () => {
  const posts = (content as unknown as { posts: { slug: { current: string }; body: RichText; bodyMeta: string }[] }).posts;
  it("has every post (54 published + 11 drafts)", () => expect(posts.length).toBe(65));
  it.each(posts.map((post) => [post.slug.current, post] as const))("post %s", (slug, post) => {
    const source = JSON.parse(fs.readFileSync(path.join(root, "src/content/blog/posts", `${slug}.json`), "utf8")).html as string;
    expect(firstDifference(source, renderRichText(post.body, post.bodyMeta))).toBeNull();
  });
});

describe("product texts round trip", () => {
  type ProductDoc = { slug: { current: string }; shortDescription?: RichText; shortDescriptionMeta?: string; includedSupplies?: string; connectedFormats?: RichText; connectedFormatsMeta?: string; tabs: { key: string; title: string; body?: RichText; bodyMeta?: string }[] };
  const products = (content as unknown as { products: ProductDoc[] }).products;
  const pages = JSON.parse(fs.readFileSync(path.join(root, "src/content/product-pages.json"), "utf8")).pages as Record<string, { shortDescription: string | null; includedSupplies: string | null; connectedFormats: string | null; tabs: { key: string; title: string; html: string | null }[] }>;
  it("has every product", () => expect(products.length).toBe(182));
  it.each(products.map((product) => [product.slug.current, product] as const))("product %s", (slug, product) => {
    const page = pages[`/product/${slug}/`];
    expect(firstDifference(page.shortDescription ?? "", renderRichText(product.shortDescription, product.shortDescriptionMeta))).toBeNull();
    expect(firstDifference(page.connectedFormats ?? "", renderRichText(product.connectedFormats, product.connectedFormatsMeta))).toBeNull();
    expect(product.includedSupplies ?? null).toBe(page.includedSupplies ?? null);
    expect(product.tabs.map((t) => [t.key, t.title])).toEqual(page.tabs.map((t) => [t.key, t.title]));
    product.tabs.forEach((tab, i) => expect(firstDifference(page.tabs[i].html ?? "", renderRichText(tab.body, tab.bodyMeta))).toBeNull());
  });
});
