/**
 * What the site search (src/lib/search/site-search.ts) looks through for a product, besides its name:
 * the short description (WordPress's excerpt) and the description (WordPress's post text) as HTML,
 * without the Elementor blocks placed in the description from elsewhere. Pure, so the Sanity check
 * (src/lib/content/render/sanity-dataset.test.ts) can prove the texts from Sanity are the copy's.
 */
import { renderRichText } from "@/lib/content/render/rich-text";
import type { RichText } from "@/lib/content/types";

import { withoutEmbeddedDocuments } from "./html";

export type ProductSearchTexts = { excerpt: string; text: string };

/** The fields the search reads from a Sanity product document. */
export type SanityProductSearchDoc = {
  slug: string;
  shopId?: number;
  shortDescription?: RichText;
  shortDescriptionMeta?: string;
  description?: { body?: RichText; bodyMeta?: string } | null;
};

/** In GROQ: a top-level block of a description that is an Elementor document placed there from elsewhere
 * (a wrapper <div> whose data-elementor-id isn't the product's own; the converter keeps the attributes as
 * JSON, scripts/sanity/lib/dom.mjs attrsJson). All of them sit at the top in the imported descriptions
 * (7.7 of their 11.5 MB), so leaving them out in the query is what keeps it small (about 4.4 MB, 3 s
 * instead of 12 MB, 6–10 s, measured on staging 9 Nov 2026). withoutEmbeddedDocuments still runs after. */
const ELEMENTOR_ID = `string::split(string::split(attrs, '"data-elementor-id":"')[1], '"')[0]`;
const EMBEDDED_DOCUMENT = `_type == "wrapperBlock" && tag == "div" && count(string::split(attrs, '"data-elementor-id":"')) > 1 && ${ELEMENTOR_ID} != string(^.^.shopId)`;

/** The GROQ projection that gives a SanityProductSearchDoc (only the description tab is read). */
export const PRODUCT_SEARCH_FIELDS = `"slug": slug.current, shopId, shortDescription, shortDescriptionMeta, "description": tabs[key == "description"][0]{"body": body[!(${EMBEDDED_DOCUMENT})], bodyMeta}`;

/** From the HTML the product page shows (the copy in src/content/, or Sanity's rendered texts). */
export function productSearchTexts(shortDescription: string | null | undefined, descriptionHtml: string | null | undefined, productId: number): ProductSearchTexts {
  return { excerpt: shortDescription ?? "", text: withoutEmbeddedDocuments(descriptionHtml ?? "", productId) };
}

/** From a Sanity product document (the same HTML its product page shows, src/lib/content/sanity.ts). */
export function sanityProductSearchTexts(doc: SanityProductSearchDoc, productId = doc.shopId ?? 0): ProductSearchTexts {
  const short = doc.shortDescription?.length ? renderRichText(doc.shortDescription, doc.shortDescriptionMeta) : null;
  const description = doc.description?.body?.length ? renderRichText(doc.description.body, doc.description.bodyMeta) : null;
  return productSearchTexts(short, description, productId);
}
