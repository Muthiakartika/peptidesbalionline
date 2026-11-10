/**
 * The page links under the blog's lists (archives, search results), as the Woodmart theme builds
 * them (its woodmart_paging_nav()): at most 5 page numbers around the current page, then
 *   "‹" previous, "›" next, "«" first and "»" last
 * when there are more than 5 pages. Measured on the live site: category page 1 of 5 shows
 * "1 2 3 4 5"; search page 1 of 9 shows "1 2 3 › »", page 3 shows "‹ 1 2 3 4 5 › »".
 */
export type PageLink = { label: string; page: number; current?: boolean };

const RANGE = 2;
const SHOW_ITEMS = RANGE * 2 + 1;

export function blogPageLinks(current: number, total: number): PageLink[] {
  if (total <= 1) return [];
  const links: PageLink[] = [];
  const many = SHOW_ITEMS < total;
  if (current > 2 && current > RANGE + 1 && many) links.push({ label: "«", page: 1 });
  if (current > 1 && many) links.push({ label: "‹", page: current - 1 });
  for (let page = 1; page <= total; page++) {
    const near = !(page >= current + RANGE + 1 || page <= current - RANGE - 1);
    if (near || !many) links.push(page === current ? { label: String(page), page, current: true } : { label: String(page), page });
  }
  if (current < total && many) links.push({ label: "›", page: current + 1 });
  if (current < total - 1 && current + RANGE - 1 < total && many) links.push({ label: "»", page: total });
  return links;
}
