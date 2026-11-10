/**
 * A product's texts (short description, included supplies note, "Also available as" box, tabs) from
 * Sanity when the site reads Sanity (src/lib/content/sanity.ts), over the WordPress copy in
 * src/content/product-pages.json. A product missing in Sanity keeps its copy. The site search reads
 * the same texts (searchTextsFor).
 */
import "server-only";

import { contentFromSanity, getSanityProductContent, getSanityProductSearchTexts, getSanityShortDescriptions } from "@/lib/content/sanity";
import { productSearchTexts, type ProductSearchTexts } from "@/lib/search/product-texts";

import type { ProductPageData } from "./product-page";

const slugOf = (path: string) => path.replace(/^\/product\//, "").replace(/\/$/, "");

export async function withProductContent<T extends ProductPageData | undefined>(page: T, path: string): Promise<T> {
  if (!page || !contentFromSanity) return page;
  const content = await getSanityProductContent(slugOf(path));
  if (!content) return page;
  return { ...page, shortDescription: content.shortDescription, includedSupplies: content.includedSupplies, connectedFormats: content.connectedFormats, tabs: content.tabs } as T;
}

/** The short description shown in the shop's list view. */
export async function shortDescriptionFor(page: ProductPageData | undefined, path: string): Promise<string | null> {
  if (!contentFromSanity) return page?.shortDescription ?? null;
  const all = await getSanityShortDescriptions();
  const slug = slugOf(path);
  return slug in all ? all[slug] : (page?.shortDescription ?? null);
}

/** What the site search looks through for this product (src/lib/search/site-search.ts): the texts its
 * product page shows, from Sanity when the product is there, else from the copy. */
export async function searchTextsFor(page: ProductPageData | undefined, path: string, productId: number): Promise<ProductSearchTexts> {
  if (contentFromSanity) {
    const all = await getSanityProductSearchTexts();
    const texts = all[slugOf(path)];
    if (texts) return texts;
  }
  return productSearchTexts(page?.shortDescription, page?.tabs.find((tab) => tab.key === "description")?.html, productId);
}
