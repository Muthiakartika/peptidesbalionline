/**
 * The site search with the site reading Sanity: products' texts as their product page shows them
 * (src/lib/catalog/product-content.ts searchTextsFor) and posts' bodies, from Sanity, else from the
 * copy; an edit shows in the next search. Sanity is replaced here by the converter's documents
 * (scripts/sanity/lib/documents.mjs, what was imported into the dataset), so no network is needed;
 * the dataset itself is checked by src/lib/content/render/sanity-dataset.test.ts.
 */
import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { convertProducts } from "../../../scripts/sanity/lib/documents.mjs";
import { firstDifference } from "../content/render/compare";
import type { RichText } from "../content/types";
import { productSearchTexts, sanityProductSearchTexts, type ProductSearchTexts, type SanityProductSearchDoc } from "./product-texts";
import samples from "./site-search-samples.json";

const sanity = vi.hoisted(() => ({ texts: {} as Record<string, ProductSearchTexts>, posts: {} as Record<string, string> }));
vi.mock("@/lib/content/sanity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/sanity")>()),
  contentFromSanity: true,
  getSanityProductSearchTexts: async () => sanity.texts,
  getSanityPostHtml: async (slug: string) => sanity.posts[slug] ?? null,
  // Everything else as if Sanity had nothing: the copy is used.
  getSanityProductContent: async () => null,
  getSanityShortDescriptions: async () => ({}),
  getSanityProductMedia: async () => ({}),
  getSanityBlock: async () => null,
  getSanityPage: async () => null,
  getSanityPopups: async () => null,
}));

const { siteSearch } = await import("./site-search");
const { getAllPosts, getPostHtml } = await import("@/lib/blog/data");

const root = path.resolve(__dirname, "../../..");
type ConvertedProduct = { slug: { current: string }; shopId: number; shortDescription?: RichText; shortDescriptionMeta?: string; tabs: { key: string; body?: RichText; bodyMeta?: string }[] };
const docs: SanityProductSearchDoc[] = (convertProducts(root) as ConvertedProduct[]).map((doc) => ({
  slug: doc.slug.current,
  shopId: doc.shopId,
  shortDescription: doc.shortDescription,
  shortDescriptionMeta: doc.shortDescriptionMeta,
  description: doc.tabs.find((tab) => tab.key === "description") ?? null,
}));
const fromSanity = () => Object.fromEntries(docs.map((doc) => [doc.slug, sanityProductSearchTexts(doc)]));
const pages = JSON.parse(fs.readFileSync(path.join(root, "src/content/product-pages.json"), "utf8")).pages as Record<string, { id: number; title: string; shortDescription: string | null; tabs: { key: string; html: string | null }[] }>;

const live = (term: string) => (samples as unknown as Record<string, [number, string, string][]>)[term].map((row) => row[0]);
const ids = async (term: string) => (await siteSearch({ query: term })).map((doc) => doc.id);

beforeEach(() => {
  sanity.texts = fromSanity();
  sanity.posts = {};
});

describe("products' search texts from Sanity", () => {
  // Sanity's HTML is the copy's as the browser shows it (src/lib/content/render/compare.ts: e.g. "<hr>"
  // for "<hr/>"), not always the same characters.
  it("are the copy's texts for all 182 products", () => {
    expect(docs).toHaveLength(182);
    for (const doc of docs) {
      const page = pages[`/product/${doc.slug}/`];
      const ours = sanityProductSearchTexts(doc);
      const copy = productSearchTexts(page.shortDescription, page.tabs.find((tab) => tab.key === "description")?.html, page.id);
      expect(firstDifference(copy.excerpt, ours.excerpt), doc.slug).toBeNull();
      expect(firstDifference(copy.text, ours.text), doc.slug).toBeNull();
    }
  });

  it("find the same results, in the same order, as the copy (the live samples and more)", async () => {
    expect(await ids("bpc")).toEqual(live("bpc"));
    expect(await ids("tirzepatide")).toEqual(live("tirzepatide"));
    const queries = ["glow", "bali peptides", "delivery canggu", "bpc 157 tb 500", "reconstitution", "-bpc peptide", "how ordering works"];
    const withSanity = await Promise.all(queries.map(ids));
    sanity.texts = {};
    expect(withSanity).toEqual(await Promise.all(queries.map(ids)));
  });

  it("a description edited in the Studio is searched as edited", async () => {
    const slug = docs[0].slug;
    const id = pages[`/product/${slug}/`].id;
    expect(await ids("zqxedited")).toEqual([]);
    sanity.texts[slug] = { ...sanity.texts[slug], text: `${sanity.texts[slug].text}<p>Now with zqxedited notes.</p>` };
    expect(await ids("zqxedited")).toEqual([id]);
  });

  it("texts removed in the Studio are no longer searched", async () => {
    // A "bpc" result found only by its texts (its name doesn't say BPC).
    const [path] = Object.entries(pages).find(([, page]) => live("bpc").includes(page.id) && !/bpc/i.test(page.title))!;
    const slug = path.replace(/^\/product\/|\/$/g, "");
    sanity.texts[slug] = { excerpt: "", text: "" };
    expect(await ids("bpc")).not.toContain(pages[path].id);
  });

  it("a product not in Sanity keeps the copy's texts", async () => {
    sanity.texts = {};
    expect(await ids("bpc")).toEqual(live("bpc"));
  });
});

describe("posts' bodies from Sanity", () => {
  it("a post body edited in the Studio is searched as edited, from the next search on", async () => {
    const post = getAllPosts()[0];
    expect(await ids("zqxpostedit")).toEqual([]);
    sanity.posts[post.slug] = `${await getPostHtml(post.slug)}<p>Updated: zqxpostedit.</p>`;
    expect(await ids("zqxpostedit")).toEqual([post.id]);
  });
});
