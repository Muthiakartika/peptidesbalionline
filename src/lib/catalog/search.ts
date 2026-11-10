/**
 * Product search, matching the live site's behaviour (measured 4 Nov 2026, see search-samples.json
 * and ajax-search-samples.json next to this file):
 *
 *   * Only the product TITLE is searched (not the description), case-insensitively, and the title
 *     as WordPress stores it, not as it displays it: " - " (shown as " – ") and straight apostrophes
 *     (shown curly). So "women's" finds "Women’s…" but "women’s" finds nothing (checked live).
 *     One title is stored with "&amp;" instead of "&" (live, "amp" finds it); that one-off is not
 *     reproduced.
 *   * Every word must appear ("blend 10mg"); a word starting with "-" must not appear ("bpc -pen").
 *   * Words are split like WordPress does: spaces, commas and "+" separate words, "quoted phrases"
 *     stay together, single letters and common English words ("the", "for", …) are ignored.
 *   * Three compound names are translated to the code names used in the product titles
 *     ("retatrutide" finds "GLP-3 RTA" products). First found by testing; the owner's script on
 *     the live pages lists exactly these three (src/lib/search/aliases.ts, Q-35).
 */
import { COMPOUND_ALIASES, compoundCode } from "@/lib/search/aliases";

/** WordPress's default search stop words (wp-includes/class-wp-query.php, get_search_stopwords). */
const STOPWORDS = new Set(
  "about,an,are,as,at,be,by,com,for,from,how,in,is,it,of,on,or,that,the,this,to,was,what,when,where,who,will,with,www".split(","),
);

/** Compound name → the code name in the product titles, e.g. "retatrutide" → "glp-3 rta" (the
 * owner's list: src/lib/search/aliases.ts). */
export const SEARCH_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(COMPOUND_ALIASES).map(([name, alias]) => [name, alias.code.toLowerCase()]),
);

export type SearchTerm = { text: string; exclude: boolean };

/** Splits a search query into words, the way WordPress's WP_Query::parse_search does. */
export function parseSearchTerms(query: string, { aliases = true }: { aliases?: boolean } = {}): SearchTerm[] {
  const raw = query.trim();
  if (!raw) return [];
  const matches = raw.match(/".*?("|$)|((?<=[\t ",+])|^)[^\t ",+]+/g) ?? [];
  const terms: SearchTerm[] = [];
  for (const match of matches) {
    const isPhrase = /^".+"$/.test(match);
    let text = isPhrase ? match.replace(/^["']+|["']+$/g, "") : match.replace(/^["' ]+|["' ]+$/g, "");
    // Single letters and lone dashes are ignored.
    if (!text || (text.length === 1 && /^[a-z-]$/i.test(text))) continue;
    if (STOPWORDS.has(text.toLowerCase())) continue;
    const exclude = text.startsWith("-");
    if (exclude) text = text.slice(1);
    if (!text) continue;
    // A compound's name, also shortened ("reta"), is searched as its code name (src/lib/search/aliases.ts).
    terms.push({ text: ((aliases ? compoundCode(text) : undefined) ?? text).toLowerCase(), exclude });
  }
  // WordPress falls back to the whole query as one phrase when nothing usable is left.
  if (terms.length === 0 || terms.length > 9) return [{ text: raw.toLowerCase(), exclude: false }];
  return terms;
}

/**
 * Undoes WordPress's display formatting (wptexturize) to get back the stored title,
 * which is what the database search compares against.
 */
export function storedTitle(title: string): string {
  return title.replace(/ – /g, " - ").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
}

export function matchesTitleSearch(title: string, terms: SearchTerm[]): boolean {
  if (terms.length === 0) return false;
  const haystack = storedTitle(title).toLowerCase();
  return terms.every((term) => haystack.includes(term.text) !== term.exclude);
}
