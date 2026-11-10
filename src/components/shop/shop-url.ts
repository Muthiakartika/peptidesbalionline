/**
 * Builds the URLs of the shop toolbar and pagination the same way WooCommerce/Woodmart do:
 *
 *   /shop/                      page 1
 *   /shop/page/2/               page 2 (query arguments such as ?orderby=date are kept)
 *   /product-category/vial/page/3/?per_page=12
 *   /page/2/?s=bpc&post_type=product   (search results)
 */

/** Query arguments that change what the archive shows. Everything else in the URL is ignored. */
export const ARCHIVE_PARAMS = ["s", "post_type", "orderby", "per_page", "shop_view", "per_row"] as const;

export type ArchiveParams = Partial<Record<(typeof ARCHIVE_PARAMS)[number], string>>;

/**
 * The address segment that carries a category or shop page's archive arguments inside the address:
 * src/proxy.ts rewrites /product-category/vial/?orderby=date to /product-category/vial/view/orderby%3Ddate/
 * (the address bar keeps the query), so those routes read no query and stay static pages
 * (ensureStatic = "navigation"): a category or page made after the build then waits for its complete
 * page on the first visit, instead of getting the route's App Shell ("Page Not Found", noindex).
 */
export const VIEW_SEGMENT = "view";

/** The archive arguments as one address segment ("orderby=date&per_page=9"), or null when there are none. */
export function viewSegment(params: ArchiveParams): string | null {
  const query = new URLSearchParams();
  for (const key of ARCHIVE_PARAMS) if (params[key] !== undefined && params[key] !== "") query.set(key, params[key]!);
  const text = query.toString();
  return text || null;
}

/** The archive arguments back from that segment, decoded or not: Next.js gives a catch-all route's
 * segments as they are in the address ("shop_view%3Dlist"), a single dynamic segment decoded. */
export function paramsFromView(segment: string | undefined): ArchiveParams {
  if (!segment) return {};
  const text = /%[0-9a-f]{2}/i.test(segment) ? decodeURIComponent(segment) : segment;
  return pickArchiveParams(Object.fromEntries(new URLSearchParams(text)));
}

/** Keeps only the archive arguments of Next.js `searchParams`, in a stable order. */
export function pickArchiveParams(searchParams: Record<string, string | string[] | undefined>): ArchiveParams {
  const picked: ArchiveParams = {};
  for (const key of ARCHIVE_PARAMS) {
    const value = searchParams[key];
    const text = Array.isArray(value) ? value[0] : value;
    if (text !== undefined && text !== "") picked[key] = text;
  }
  return picked;
}

/** URL of page `page` of an archive whose first page is `basePath` ("/shop/", "/product-category/vial/", "/"). */
export function archiveHref(basePath: string, page: number, params: ArchiveParams, overrides: ArchiveParams = {}): string {
  const path = page > 1 ? `${basePath}page/${page}/` : basePath;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value !== undefined && value !== "") query.set(key, value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
