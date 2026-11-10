/**
 * Content from Sanity: pages, shared sections (incl. the block under "Add to cart") and the homepage
 * popups, turned into the same HTML the files in src/content/ hold (./render/).
 *
 * Switch: CONTENT_SOURCE=sanity (with NEXT_PUBLIC_SANITY_DATASET = the dataset to show, e.g. staging)
 * makes the site read Sanity; anything not found there falls back to src/content/. Unset, the site
 * keeps using src/content/ (the copy of the live site).
 *
 * Caching: each answer is cached ("use cache", tag "sanity") until Sanity's webhook calls
 * /api/sanity/revalidate after a publish. Queries skip Sanity's CDN so that refresh is never stale.
 */
import "server-only";

import { createClient, type SanityClient } from "next-sanity";
import { cacheLife, cacheTag } from "next/cache";

import type { PageSeo } from "@/lib/catalog/types";
import { PRODUCT_SEARCH_FIELDS, sanityProductSearchTexts, type ProductSearchTexts, type SanityProductSearchDoc } from "@/lib/search/product-texts";
import { apiVersion, dataset, isSanityConfigured, projectId } from "@/sanity/env";

import { renderDocument } from "./render/elementor";
import { renderRichText } from "./render/rich-text";
import { defaultSiteChrome, siteChromeFrom, type SiteChrome } from "./site-chrome-merge";
import type { ElementorDocument, RichText, SharedSection } from "./types";

export const SANITY_TAG = "sanity";

/**
 * How long a page built from Sanity is kept. With the publish webhook set up (SANITY_REVALIDATE_SECRET),
 * until the webhook says something changed; without it (e.g. on this computer, which webhooks can't
 * reach), a minute: the first visit after that rebuilds the page in the background.
 */
function cachedFromSanity() {
  cacheTag(SANITY_TAG);
  if (process.env.SANITY_REVALIDATE_SECRET) cacheLife("max");
  else cacheLife("minutes");
}

export const contentFromSanity = process.env.CONTENT_SOURCE === "sanity" && isSanityConfigured;

let client: SanityClient | undefined;
function sanity(): SanityClient {
  client ??= createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: "published" });
  return client;
}

/** Shared sections resolved inside the answer, so one query gives everything a page needs. */
const SECTIONS = `sections[]{..., _type == "sharedSectionRef" => {..., "shared": section->{_id, title, docId, rootAttrs, sections}}}`;

type SanityPage = ElementorDocument & {
  _updatedAt: string;
  path: string;
  family: string;
  docId: number;
  stylesheets?: number[];
  articleClass?: string;
  pageTitleHtml?: string;
  plain?: boolean;
  body?: RichText;
  bodyMeta?: string;
  toolConfig?: string;
  toolScripts?: string[];
  seo?: Partial<PageSeo>;
};

export type RenderedPage = {
  generatedAt: string;
  path: string;
  family: string;
  docId: number;
  stylesheets: number[];
  articleClass: string;
  pageTitleHtml?: string;
  html: string;
  plain?: boolean;
  toolConfig?: string;
  toolScripts?: string[];
  seo: PageSeo;
};

const seoOf = (seo: Partial<PageSeo> | undefined): PageSeo => ({
  title: seo?.title ?? "",
  description: seo?.description || null,
  robots: seo?.robots || null,
  ogType: seo?.ogType || null,
  ogTitle: seo?.ogTitle || null,
  ogDescription: seo?.ogDescription || null,
});

/** A page by its file name ("home", "bpc-157-bali", "peptide-jakarta"…), or null. */
export async function getSanityPage(name: string): Promise<RenderedPage | null> {
  "use cache";
  cachedFromSanity();
  const doc = await sanity().fetch<SanityPage | null>(`*[_type == "page" && name == $name][0]{..., ${SECTIONS}}`, { name });
  if (!doc) return null;
  return {
    generatedAt: doc._updatedAt,
    path: doc.path,
    family: doc.family,
    docId: doc.docId,
    stylesheets: doc.stylesheets ?? [],
    articleClass: doc.articleClass ?? "",
    ...(doc.pageTitleHtml ? { pageTitleHtml: doc.pageTitleHtml } : {}),
    html: doc.plain ? renderRichText(doc.body, doc.bodyMeta) : renderDocument(doc),
    ...(doc.plain ? { plain: true } : {}),
    ...(doc.toolConfig ? { toolConfig: doc.toolConfig } : {}),
    ...(doc.toolScripts ? { toolScripts: doc.toolScripts } : {}),
    seo: seoOf(doc.seo),
  };
}

/** The homepage popups as { id, settings, html } (the shape of src/content/popups/*.json). */
export async function getSanityPopups(): Promise<{ id: number; settings: unknown; html: string }[] | null> {
  "use cache";
  cachedFromSanity();
  const docs = await sanity().fetch<(ElementorDocument & { popupId: number; settings?: string })[]>(`*[_type == "popup"] | order(popupId asc){popupId, settings, rootAttrs, sections}`);
  if (!docs.length) return null;
  return docs.map((doc) => {
    let settings: unknown = {};
    try {
      settings = JSON.parse(doc.settings ?? "{}");
    } catch {}
    return { id: doc.popupId, settings, html: renderDocument(doc) };
  });
}

/** A blog post's text as HTML, or null when the post isn't in Sanity. */
export async function getSanityPostHtml(slug: string): Promise<string | null> {
  "use cache";
  cachedFromSanity();
  const doc = await sanity().fetch<{ body?: RichText; bodyMeta?: string } | null>(`*[_type == "post" && slug.current == $slug][0]{body, bodyMeta}`, { slug });
  return doc ? renderRichText(doc.body, doc.bodyMeta) : null;
}

export type ProductContent = { shortDescription: string | null; includedSupplies: string | null; connectedFormats: string | null; tabs: { key: string; title: string; html: string | null }[] };

/**
 * One product's texts as HTML, or null when it isn't in Sanity. One query per product on purpose: a
 * single query for all 182 (about 12 MB) in each of the build's workers ran this computer out of
 * memory on 9 Nov 2026.
 */
export async function getSanityProductContent(slug: string): Promise<ProductContent | null> {
  "use cache";
  cachedFromSanity();
  type Doc = {
    shortDescription?: RichText;
    shortDescriptionMeta?: string;
    includedSupplies?: string;
    connectedFormats?: RichText;
    connectedFormatsMeta?: string;
    tabs?: { key?: string; title?: string; body?: RichText; bodyMeta?: string }[];
  };
  const doc = await sanity().fetch<Doc | null>(`*[_type == "product" && slug.current == $slug][0]{shortDescription, shortDescriptionMeta, includedSupplies, connectedFormats, connectedFormatsMeta, tabs}`, { slug });
  if (!doc) return null;
  return {
    shortDescription: doc.shortDescription?.length ? renderRichText(doc.shortDescription, doc.shortDescriptionMeta) : null,
    includedSupplies: doc.includedSupplies || null,
    connectedFormats: doc.connectedFormats?.length ? renderRichText(doc.connectedFormats, doc.connectedFormatsMeta) : null,
    tabs: (doc.tabs ?? []).map((tab) => ({ key: tab.key ?? "", title: tab.title ?? "", html: tab.body?.length ? renderRichText(tab.body, tab.bodyMeta) : null })),
  };
}

/** Every product's short description as HTML, by slug (the shop's list view shows many at once). */
export async function getSanityShortDescriptions(): Promise<Record<string, string | null>> {
  "use cache";
  cachedFromSanity();
  const docs = await sanity().fetch<{ slug: string; shortDescription?: RichText; shortDescriptionMeta?: string }[]>(
    `*[_type == "product" && defined(slug.current)]{"slug": slug.current, shortDescription, shortDescriptionMeta}`,
  );
  return Object.fromEntries(docs.map((doc) => [doc.slug, doc.shortDescription?.length ? renderRichText(doc.shortDescription, doc.shortDescriptionMeta) : null]));
}

/**
 * The site search's texts for every product in Sanity, by slug (src/lib/search/product-texts.ts):
 * about 1.6 MB for the 182 products, because the Elementor blocks placed in the descriptions from
 * elsewhere (most of their 9 MB) are left out, already in the query. Only the search reads it, and
 * the search is rendered on request, never during the build.
 */
export async function getSanityProductSearchTexts(): Promise<Record<string, ProductSearchTexts>> {
  "use cache";
  cachedFromSanity();
  const docs = await sanity().fetch<SanityProductSearchDoc[]>(`*[_type == "product" && defined(slug.current)]{${PRODUCT_SEARCH_FIELDS}}`);
  return Object.fromEntries(docs.map((doc) => [doc.slug, sanityProductSearchTexts(doc)]));
}

/** Pictures chosen in Sanity for products (Products → Images), by document id. Not cached here: the
 * catalogue that uses them is (src/lib/catalog/store.ts). */
export async function getSanityProductMedia(): Promise<Record<string, { url: string; alt?: string; width?: number; height?: number }[]>> {
  const docs = await sanity().fetch<{ _id: string; images?: { url?: string; alt?: string; width?: number; height?: number }[] }[]>(
    `*[_type == "product" && !(_id in path("drafts.**")) && count(images[defined(url)]) > 0]{_id, images}`,
  );
  return Object.fromEntries(
    docs.map((doc) => [
      doc._id,
      (doc.images ?? []).filter((image) => image.url).map((image) => ({ url: image.url!, alt: image.alt, width: image.width, height: image.height })),
    ]),
  );
}

/** What every page shows (top bar, menu, footer, cookie bar, age gate), Sanity over the defaults. */
export async function getSiteChrome(): Promise<SiteChrome> {
  if (!contentFromSanity) return defaultSiteChrome;
  return getSanitySiteChrome();
}

async function getSanitySiteChrome(): Promise<SiteChrome> {
  "use cache";
  cachedFromSanity();
  const settings = await sanity().fetch<Record<string, unknown> | null>(`*[_id == "siteSettings"][0]{announcements, mainMenu, footer, ageGate, cookieNotice}`);
  return siteChromeFrom(settings);
}

/** An Elementor block kept as a shared section (e.g. #701 under "Add to cart"), as HTML, or null. */
export async function getSanityBlock(docId: number): Promise<string | null> {
  "use cache";
  cachedFromSanity();
  const doc = await sanity().fetch<SharedSection | null>(`*[_type == "sharedSection" && docId == $docId][0]{rootAttrs, sections}`, { docId });
  return doc ? renderDocument(doc) : null;
}
