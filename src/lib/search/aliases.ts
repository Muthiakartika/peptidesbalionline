/**
 * The three compound names the live site translates to the code names in its product titles, with
 * the note it shows while someone types them (the owner's inline script on every live page, read
 * 6 Nov 2026; this answers open question Q-35: these three are the whole list).
 *
 *   * the product search and the site search look for the code name instead ("retatrutide" finds
 *     the "GLP-3 RTA" products): src/lib/catalog/search.ts, src/lib/search/site-search.ts;
 *   * the search boxes and the search results pages show the note, which links to the code name's
 *     product search: src/components/layout/search/AliasNotice.tsx.
 */

export type CompoundAlias = {
  /** The code name in the product titles, e.g. "GLP-3 RTA". */
  code: string;
  /** The note shows from this many typed letters of the compound name ("reta" for retatrutide). */
  min: number;
  note: string;
};

/** In the live script's order (the order the notes are listed in when several match). */
export const COMPOUND_ALIASES = {
  semaglutide: { code: "GLP-1 SMA", min: 5, note: "Known as semaglutide, it is a GLP-1 receptor agonist used for weight loss and blood sugar management." },
  tirzepatide: { code: "GLP-2 TRZ", min: 4, note: "Known as tirzepatide, it is a dual agonist targeting both GLP-1 and GIP receptors." },
  retatrutide: { code: "GLP-3 RTA", min: 4, note: "Known as retatrutide, it is a triple agonist that activates GLP-1, GIP, and glucagon receptors." },
} as const satisfies Record<string, CompoundAlias>;

export type CompoundName = keyof typeof COMPOUND_ALIASES;

/** Where a note leads: the product search for the code name, e.g. /?s=GLP-3+RTA&post_type=product. */
export function aliasSearchPath(name: CompoundName): string {
  return `/?s=${COMPOUND_ALIASES[name].code.replace(/ /g, "+")}&post_type=product`;
}

/** The code name one search word stands for ("reta" → "GLP-3 RTA", "retatrutide10mg" → "GLP-3 RTA"),
 * or undefined. */
export function compoundCode(word: string): string | undefined {
  const [name] = matchCompoundAliases(word);
  return name ? COMPOUND_ALIASES[name].code : undefined;
}

/**
 * The search text as the owner's code hands it to WordPress: every word that names a compound (by
 * the same rule as the note) replaced by its code name. Measured on live 6 Nov 2026: "reta",
 * "retat", "retatrutide" and "retatrutide10mg" all give the 7 GLP-3 RTA products, "ret" gives none,
 * "sema" (shorter than semaglutide's 5) is searched as it is (Semax), "reta 10mg" finds the one
 * GLP-3 RTA 10mg product.
 */
export function translateCompoundNames(query: string): string {
  return query.replace(/\S+/g, (word) => compoundCode(word) ?? word);
}

/**
 * The compounds a search text refers to, as the live script decides: each word (lower case, only
 * letters and digits kept) of at least the compound's `min` letters that starts the compound's name,
 * or that starts with it ("retatrutide10mg"). Each compound once, in the order of the words.
 */
export function matchCompoundAliases(query: string): CompoundName[] {
  const names = Object.keys(COMPOUND_ALIASES) as CompoundName[];
  const out: CompoundName[] = [];
  for (const word of (query || "").toLowerCase().split(/\s+/)) {
    const text = word.replace(/[^a-z0-9]/g, "");
    for (const name of names) {
      if (text.length >= COMPOUND_ALIASES[name].min && (name.startsWith(text) || text.startsWith(name)) && !out.includes(name)) out.push(name);
    }
  }
  return out;
}
