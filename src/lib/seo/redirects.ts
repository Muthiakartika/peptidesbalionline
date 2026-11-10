/**
 * The live site's old addresses (WordPress "Redirection" plugin, 196 rules exported on 6 Nov 2026 into
 * src/content/seo/redirects.json), answered by Next.js before any page or the proxy (next.config.ts
 * `redirects`), so they also work for /product/ and /product-category/ addresses, which src/proxy.ts
 * doesn't see.
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
import data from "../../content/seo/redirects.json";

type Rule = [from: string, to: string | null, status: number];

export type LegacyRedirect = { source: string; destination: string; statusCode: 301 };

export const legacyRules = data.redirects as Rule[];

/** The rules as Next.js redirects (next.config.ts). */
export function legacyRedirects(): LegacyRedirect[] {
  return legacyRules
    .filter((rule): rule is [string, string, 301] => rule[2] === 301 && typeof rule[1] === "string")
    .map(([source, destination]) => ({ source, destination, statusCode: 301 }));
}
