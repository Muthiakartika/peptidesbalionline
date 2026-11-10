/**
 * Checks a Sanity dataset itself (not the converter): every page, popup and shared block read back from
 * Sanity renders as the copy of the live site in src/content/. Runs only when asked, because it reads
 * the dataset over the network:
 *
 *   SANITY_VERIFY_DATASET=staging npx vitest run src/lib/content/render/sanity-dataset.test.ts
 *
 * After editors change content in that dataset, differences are expected (that is the point of
 * editing); use it right after an import.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@sanity/client";
import { describe, expect, it } from "vitest";

import { PRODUCT_SEARCH_FIELDS, productSearchTexts, sanityProductSearchTexts, type SanityProductSearchDoc } from "../../search/product-texts";
import type { ElementorDocument, RichText, SharedSection } from "../types";
import { firstDifference } from "./compare";
import { renderDocument } from "./elementor";
import { renderRichText } from "./rich-text";

const root = path.resolve(__dirname, "../../../..");
const dataset = process.env.SANITY_VERIFY_DATASET;
if (dataset && fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";

const SECTIONS = `sections[]{..., _type == "sharedSectionRef" => {..., "shared": section->{_id, title, docId, rootAttrs, sections}}}`;

describe.skipIf(!dataset || !projectId)(`Sanity dataset "${dataset}"`, async () => {
  const client = createClient({ projectId: projectId || "unset", dataset, apiVersion: "2026-11-01", useCdn: false });
  const pages = dataset ? await client.fetch<(ElementorDocument & { name: string; plain?: boolean; body?: RichText; bodyMeta?: string })[]>(`*[_type == "page"]{name, plain, body, bodyMeta, rootAttrs, ${SECTIONS}}`) : [];
  const popups = dataset ? await client.fetch<(ElementorDocument & { popupId: number })[]>(`*[_type == "popup"]{popupId, rootAttrs, sections}`) : [];
  const block = dataset ? await client.fetch<SharedSection | null>(`*[_type == "sharedSection" && docId == 701][0]{rootAttrs, sections}`) : null;
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

  it("has every page", () => {
    expect(pages.length).toBe(75);
  });

  it.each(pages.map((page) => [page.name, page] as const))("page %s", (name, page) => {
    const html = page.plain ? renderRichText(page.body, page.bodyMeta) : renderDocument(page);
    expect(firstDifference(read(`src/content/pages/${name}.json`).html, html)).toBeNull();
  });

  it.each(popups.map((popup) => [popup.popupId, popup] as const))("popup %s", (id, popup) => {
    expect(firstDifference(read(`src/content/popups/${id}.json`).html, renderDocument(popup))).toBeNull();
  });

  const posts = dataset ? await client.fetch<{ slug: string; body?: RichText; bodyMeta?: string }[]>(`*[_type == "post"]{"slug": slug.current, body, bodyMeta}`) : [];
  it.each(posts.map((post) => [post.slug, post] as const))("post %s", (slug, post) => {
    expect(firstDifference(read(`src/content/blog/posts/${slug}.json`).html, renderRichText(post.body, post.bodyMeta))).toBeNull();
  });

  type ProductDoc = { slug: string; shortDescription?: RichText; shortDescriptionMeta?: string; connectedFormats?: RichText; connectedFormatsMeta?: string; tabs?: { body?: RichText; bodyMeta?: string }[] };
  const products = dataset ? await client.fetch<ProductDoc[]>(`*[_type == "product"]{"slug": slug.current, shortDescription, shortDescriptionMeta, connectedFormats, connectedFormatsMeta, tabs}`) : [];
  const productPages = dataset ? read("src/content/product-pages.json").pages : {};
  it.each(products.map((product) => [product.slug, product] as const))("product %s", (slug, product) => {
    const page = productPages[`/product/${slug}/`];
    expect(firstDifference(page.shortDescription ?? "", renderRichText(product.shortDescription, product.shortDescriptionMeta))).toBeNull();
    expect(firstDifference(page.connectedFormats ?? "", renderRichText(product.connectedFormats, product.connectedFormatsMeta))).toBeNull();
    (product.tabs ?? []).forEach((tab, i) => expect(firstDifference(page.tabs[i].html ?? "", renderRichText(tab.body, tab.bodyMeta))).toBeNull());
  });

  // The site search's texts (src/lib/search/product-texts.ts), read with the site's own query.
  const searchDocs = dataset ? await client.fetch<SanityProductSearchDoc[]>(`*[_type == "product" && defined(slug.current)]{${PRODUCT_SEARCH_FIELDS}}`) : [];
  it.each(searchDocs.map((doc) => [doc.slug, doc] as const))("search texts %s", (slug, doc) => {
    const page = productPages[`/product/${slug}/`];
    const ours = sanityProductSearchTexts(doc);
    const copy = productSearchTexts(page.shortDescription, page.tabs.find((tab: { key: string }) => tab.key === "description")?.html, page.id);
    expect(firstDifference(copy.excerpt, ours.excerpt)).toBeNull();
    expect(firstDifference(copy.text, ours.text)).toBeNull();
  });

  it("block 701", () => {
    expect(block).not.toBeNull();
    expect(firstDifference(read("src/content/product-pages.json").blocks["701"], renderDocument(block!))).toBeNull();
  });
});
