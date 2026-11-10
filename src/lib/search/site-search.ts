/**
 * The site search (/?s=bpc, the homepage's search boxes): WordPress's own search over products,
 * blog posts and pages, as the live site runs it (the header search and /?s=…&post_type=product are
 * the product search instead, src/lib/catalog/search.ts).
 *
 * WordPress (WP_Query::parse_search and parse_search_order) does this:
 *   * every word must appear in the title, the excerpt or the text (case-insensitive); "-word" must
 *     not; the words are split as in the product search (parseSearchTerms);
 *   * order: for one word, the ones with the word in their title first, then the rest, newest first
 *     within each; for several words, in this order: the whole query in the title, all words in the
 *     title, any word in the title, the whole query in the excerpt, the whole query in the text,
 *     the rest, newest first within each;
 *   * 10 per page.
 * Like the product search, three compound names are replaced by the code names in the titles
 * ("tirzepatide" searches for "GLP-2 TRZ", so the "Tirzepatide…" pages are not found; checked on the
 * live site); open question Q-35.
 *
 * WordPress compares the words with the HTML as stored in its database, tags and addresses included
 * (so "bali" also finds every text with a link to peptidesbali.online). This project searches the
 * HTML it has: products' short description and description (as their product page shows them,
 * src/lib/search/product-texts.ts), posts' text, and for pages their text
 * (src/content/search/pages.json; WordPress's own copy of an Elementor page isn't public).
 * So the list can differ a little from the live one; src/lib/search/site-search.test.ts measures
 * how much.
 */
import "server-only";

import searchPages from "@/content/search/pages.json";
import { getAllPosts, getPostHtml } from "@/lib/blog/data";
import { getAllProducts } from "@/lib/catalog";
import { searchTextsFor } from "@/lib/catalog/product-content";
import { getProductPage } from "@/lib/catalog/product-page";
import { parseSearchTerms, storedTitle, type SearchTerm } from "@/lib/catalog/search";
import { translateCompoundNames } from "@/lib/search/aliases";

export const SEARCH_PER_PAGE = 10;

export type SearchDocument = {
  id: number;
  type: "product" | "post" | "page";
  /** The title as WordPress stores it (what the search compares against). */
  title: string;
  /** The title as the page shows it. */
  displayTitle: string;
  path: string;
  date: string;
  modified: string;
  /** The excerpt and the text, as HTML where this project has it (posts, products), else plain text. */
  excerpt: string;
  text: string;
  /** Pages only: their links' and pictures' addresses (searched too, see above). */
  addresses?: string;
  commentsOpen: boolean;
};

/**
 * Plain text of some HTML, as WordPress's strip_tags makes it: tags removed without adding spaces
 * ("<strong>Bali</strong>?" -> "Bali?"; the line breaks between paragraphs separate the words),
 * entities decoded, white space collapsed.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;/g, "’")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export { withoutCaptions, withoutEmbeddedDocuments } from "./html";

let documents: Promise<SearchDocument[]> | null = null;

/** The products' part of the search: rebuilt on each search, so products added, archived or renamed in
 * /admin/products/ show (or stop showing) at once, with the texts their product page shows (from
 * Sanity when the site reads Sanity, so a description edited in the Studio is searched as edited).
 * The catalogue and Sanity's texts are cached (src/lib/catalog/store.ts, src/lib/content/sanity.ts). */
async function productDocuments(): Promise<SearchDocument[]> {
  const products = await getAllProducts();
  return Promise.all(
    products.map(async (product) => {
      const { excerpt, text } = await searchTextsFor(await getProductPage(product.path), product.path, product.id);
      return {
        id: product.id,
        type: "product" as const,
        title: storedTitle(product.name),
        displayTitle: product.name,
        path: product.path,
        date: product.date,
        modified: product.date,
        excerpt,
        text,
        commentsOpen: false,
      };
    }),
  );
}

/** Everything the search looks through. */
export async function getSearchDocuments(): Promise<SearchDocument[]> {
  const [products, posts] = await Promise.all([productDocuments(), postDocuments()]);
  return [...products, ...posts, ...(await pageDocuments())];
}

/** The posts' part: rebuilt on each search too, so a post body edited in the Studio is searched as
 * edited (each body is cached by src/lib/content/sanity.ts; the copy's files are read once). */
function postDocuments(): Promise<SearchDocument[]> {
  return Promise.all(
    getAllPosts().map(async (post) => ({
      id: post.id,
      type: "post" as const,
      title: storedTitle(post.title),
      displayTitle: post.title,
      path: post.path,
      date: post.date,
      modified: post.modified,
      excerpt: "",
      text: await getPostHtml(post.slug),
      commentsOpen: post.commentsOpen,
    })),
  );
}

/** The pages' part (src/content/search/pages.json), read once per server process. */
function pageDocuments(): Promise<SearchDocument[]> {
  documents ??= Promise.resolve(
    (searchPages as { id: number; title: string; date: string; modified: string; path: string; commentsOpen: boolean; text: string; addresses: string }[]).map((page) => ({
      id: page.id,
      type: "page" as const,
      title: storedTitle(page.title),
      displayTitle: page.title,
      path: page.path,
      date: page.date,
      modified: page.modified,
      excerpt: "",
      text: page.text,
      addresses: page.addresses,
      commentsOpen: page.commentsOpen,
    })),
  );
  return documents;
}

const has = (field: string, term: string) => field.toLowerCase().includes(term);

function matches(doc: SearchDocument, terms: SearchTerm[]): boolean {
  return terms.every((term) => {
    const found = has(doc.title, term.text) || has(doc.excerpt, term.text) || has(doc.text, term.text) || has(doc.addresses ?? "", term.text);
    return term.exclude ? !found : found;
  });
}

/** WordPress's relevance groups (lower comes first). */
function rank(doc: SearchDocument, words: string[], sentence: string): number {
  if (words.length <= 1) return words.length === 1 && has(doc.title, words[0]) ? 0 : 1;
  const title = doc.title.toLowerCase();
  if (title.includes(sentence)) return 1;
  if (words.length < 7 && words.every((word) => has(doc.title, word))) return 2;
  if (words.some((word) => has(doc.title, word))) return 3;
  if (doc.excerpt.toLowerCase().includes(sentence)) return 4;
  if (doc.text.toLowerCase().includes(sentence)) return 5;
  return 6;
}

export type SiteSearchOptions = { query: string; postType?: "post" | "page" | "product" };

export async function siteSearch({ query, postType }: SiteSearchOptions): Promise<SearchDocument[]> {
  // The live site replaces the compound names in the search text itself ("tirzepatide", also
  // shortened: "tirz" -> "GLP-2 TRZ") before WordPress reads it, so "glp-2" and "trz" are then two
  // words, and "glp-2 trz" is the whole query (measured: products with it in their short
  // description come right after the titles).
  const replaced = translateCompoundNames(query);
  const terms = parseSearchTerms(replaced, { aliases: false });
  if (!terms.length) return [];
  const words = terms.filter((term) => !term.exclude).map((term) => term.text);
  const sentence = replaced.trim().toLowerCase();
  const docs = (await getSearchDocuments()).filter((doc) => (!postType || doc.type === postType) && matches(doc, terms));
  return docs
    .map((doc) => ({ doc, rank: rank(doc, words, sentence) }))
    .sort((a, b) => a.rank - b.rank || b.doc.date.localeCompare(a.doc.date))
    .map(({ doc }) => doc);
}

/** WordPress's excerpt in the search results: the first 20 words of the text (wp_trim_words). */
export function searchExcerpt(text: string, words = 20): string {
  return text.split(/\s+/).filter(Boolean).slice(0, words).join(" ");
}
