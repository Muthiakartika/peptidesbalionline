/**
 * The bar above the product grid (redesigned 12 Nov 2026 after the owner's reference shops):
 *
 *   "Showing 1–21 of 182 results"            [ Search products ] [ Sort ▾ ] [ ▦ ▥ ▤ ]
 *
 * The categories are the chips in the title band (ShopHero), so there is no sidebar any more. The
 * search box searches the whole shop (the site's product search, /?s=…&post_type=product), and the
 * view buttons switch between the grid (4 per row, or 3) and the list (?shop_view=list). Old links
 * with ?per_page= still work; the "Show 9 / 12 / 18 / 24" links are gone.
 */
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { sortOptions, type Listing } from "@/lib/catalog";

import { OrderbySelect } from "./ShopToolbarControls";
import { archiveHref, type ArchiveParams } from "./shop-url";

/** WooCommerce's result-count sentence. */
export function resultCountText(listing: Listing, perPage: number): string {
  if (listing.total === 1) return "Showing the single result";
  if (listing.total <= perPage) return `Showing all ${listing.total} results`;
  return `Showing ${listing.first}–${listing.last} of ${listing.total} results`;
}

export function ShopToolbar({ listing, perPage, basePath, params, isSearch, search }: { listing: Listing; perPage: number; basePath: string; params: ArchiveParams; isSearch: boolean; search?: string }) {
  const hasProducts = listing.total > 0;
  const options = isSearch ? [{ value: "relevance", label: "Relevance" }, ...sortOptions.slice(1)] : sortOptions;
  // The grid of 4 is the default; ?shop_view=grid&per_row=3 and ?shop_view=list are the others.
  const view = params.shop_view === "list" ? "list" : params.shop_view === "grid" && params.per_row === "3" ? "grid-3" : "grid-4";
  // The sort form keeps the other arguments as hidden fields and restarts at page 1 (WooCommerce).
  const hidden = { ...params, orderby: undefined };

  return (
    <div className="shop-toolbar">
      <p className="shop-result-count" role="status" aria-relevant="all">
        {hasProducts ? resultCountText(listing, perPage) : "No products found"}
      </p>
      <div className="shop-toolbar__controls">
        <form role="search" method="get" action="/" className="shop-find" autoComplete="off">
          <Icon name="search" />
          <input type="search" name="s" required placeholder="Search products" aria-label="Search products" defaultValue={search} />
          <input type="hidden" name="post_type" value="product" />
        </form>
        {hasProducts ? (
          <>
            <OrderbySelect options={options} value={listing.orderby} basePath={basePath} hidden={hidden} />
            <div className="shop-view" role="group" aria-label="View">
              <Link rel="nofollow noopener" href={archiveHref(basePath, 1, params, { shop_view: undefined, per_row: undefined })} className="shop-view__link" data-current={view === "grid-4" || undefined} aria-label="Grid, 4 per row">
                <Icon name="viewGrid4" />
              </Link>
              <Link rel="nofollow noopener" href={archiveHref(basePath, 1, params, { shop_view: "grid", per_row: "3" })} className="shop-view__link" data-current={view === "grid-3" || undefined} aria-label="Grid, 3 per row">
                <Icon name="viewGrid3" />
              </Link>
              <Link rel="nofollow noopener" href={archiveHref(basePath, 1, params, { shop_view: "list", per_row: undefined })} className="shop-view__link" data-current={view === "list" || undefined} aria-label="List view">
                <Icon name="viewList" />
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
