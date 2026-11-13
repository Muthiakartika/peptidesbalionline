/**
 * The live site's old addresses, answered by Next.js before any page or the proxy (next.config.ts
 * `redirects`), so they also work for /product/ and /product-category/ addresses, which src/proxy.ts
 * doesn't see. Two sources, as WordPress has them:
 *   * the "Redirection" plugin: 196 rules exported on 6 Nov 2026 (src/content/seo/redirects.json; the 12 Nov
 *     dump has the same 196);
 *   * WordPress's own old-slug redirects: a product renamed in WooCommerce keeps its old address
 *     (_wp_old_slug) and WordPress answers it with a 301 to the new one. 51 of them aren't plugin rules
 *     (src/content/seo/old-slug-redirects.json, each checked against live on 13 Nov 2026).
 *
 * As on live: status 301, letter case ignored (/TERMS/ too). The one rule that answers 404 isn't
 * listed: that product doesn't exist here, so its address already gets the 404 page.
 * Differences from live, both small:
 *   * an address without the final "/" first gets Next.js's usual 308 to the address with "/", then
 *     the 301 (live: one 301), as for every page of the site;
 *   * a query is kept (/terms/?utm_source=x → /terms-conditions/?utm_source=x). On live the rules
 *     only match an address without a query; with one, WordPress itself answers: its old-slug
 *     redirect for products drops the query, its slug guess for pages keeps it.
 */
import oldSlugs from "../../content/seo/old-slug-redirects.json";
import data from "../../content/seo/redirects.json";

type Rule = [from: string, to: string | null, status: number];

export type LegacyRedirect = { source: string; destination: string; statusCode: 301 };

/** The Redirection plugin's rules. */
export const legacyRules = data.redirects as Rule[];

/** WordPress's old-slug redirects that aren't plugin rules. */
export const oldSlugRules = oldSlugs.redirects as Rule[];

/** Every rule as a Next.js redirect (next.config.ts). */
export function legacyRedirects(): LegacyRedirect[] {
  return [...legacyRules, ...oldSlugRules]
    .filter((rule): rule is [string, string, 301] => rule[2] === 301 && typeof rule[1] === "string")
    .map(([source, destination]) => ({ source, destination, statusCode: 301 }));
}
