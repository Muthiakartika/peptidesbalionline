/**
 * The parts of a text WordPress's search doesn't look at, removed from the HTML (pure functions, used by
 * the site search, src/lib/search/site-search.ts, and by the products' search texts read from Sanity,
 * src/lib/search/product-texts.ts).
 */

/**
 * A product description without the Elementor blocks placed in it from elsewhere (an Elementor
 * document whose id isn't the product's own): WordPress stores those as a shortcode
 * ("[elementor-template id=…]"), so their text isn't searched on the live site (checked: removing
 * them is what makes "bpc" find the same products as live).
 */
export function withoutEmbeddedDocuments(html: string, ownId: number): string {
  return withoutDivs(html, (open) => {
    const id = /\bdata-elementor-id="(\d+)"/.exec(open);
    return id !== null && Number(id[1]) !== ownId;
  });
}

/** A post's text without its pictures' captions: WordPress stores them as a [caption] shortcode,
 * which its excerpt drops (checked on the live search results). */
export function withoutCaptions(html: string): string {
  return withoutDivs(html, (open) => /\bclass="[^"]*\bwp-caption\b/.test(open));
}

/** The HTML without the <div>s (and everything inside them) whose opening tag `remove` picks. */
function withoutDivs(html: string, remove: (openTag: string) => boolean): string {
  let out = html;
  for (;;) {
    const open = [...out.matchAll(/<div\b[^>]*>/g)].find((m) => remove(m[0]));
    if (!open || open.index === undefined) return out;
    // Find the matching </div> by counting the <div>s opened inside.
    const tags = /<div\b[^>]*>|<\/div>/g;
    tags.lastIndex = open.index + open[0].length;
    let depth = 1;
    let end = out.length;
    for (let tag = tags.exec(out); tag; tag = tags.exec(out)) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = tag.index + tag[0].length;
        break;
      }
    }
    out = out.slice(0, open.index) + out.slice(end);
  }
}
