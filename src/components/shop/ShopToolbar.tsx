/**
 * The bar above the product grid: "Showing 1–21 of 182 results", "Show : 9 / 12 / 18 / 24",
 * the three view icons and the sort dropdown. On tablets and phones it shows "Show sidebar" and a
 * sort icon instead (Elementor template #9495 on the live site).
 */
import Link from "next/link";
import { Fragment } from "react";

import { Icon } from "@/components/ui/Icon";
import { perPageChoices, sortOptions, type Listing } from "@/lib/catalog";

import { OrderbySelect, SidebarButton } from "./ShopToolbarControls";
import { archiveHref, type ArchiveParams } from "./shop-url";

/** WooCommerce's result-count sentence. */
export function resultCountText(listing: Listing, perPage: number): string {
  if (listing.total === 1) return "Showing the single result";
  if (listing.total <= perPage) return `Showing all ${listing.total} results`;
  return `Showing ${listing.first}–${listing.last} of ${listing.total} results`;
}

export function ShopToolbar({ listing, perPage, basePath, params, isSearch }: { listing: Listing; perPage: number; basePath: string; params: ArchiveParams; isSearch: boolean }) {
  const hasProducts = listing.total > 0;
  const options = isSearch ? [{ value: "relevance", label: "Relevance" }, ...sortOptions.slice(1)] : sortOptions;
  const view = params.shop_view === "list" ? "list" : params.shop_view === "grid" ? `grid-${params.per_row ?? ""}` : null;
  // The sort form keeps the other arguments as hidden fields and restarts at page 1 (WooCommerce).
  const hidden = { ...params, orderby: undefined };

  return (
    <div className="shop-toolbar">
      <div className="shop-toolbar__left">
        {hasProducts ? (
          <p className="shop-result-count" role="status" aria-relevant="all">
            {resultCountText(listing, perPage)}
          </p>
        ) : null}
      </div>
      <div className="shop-toolbar__right">
        <div className="shop-toolbar__sidebar-button">
          <SidebarButton />
        </div>
        {hasProducts ? (
          <>
            <div className="shop-per-page">
              <span className="shop-per-page__label"> Show </span>
              {perPageChoices.map((choice) => (
                <Fragment key={choice}>
                  <Link
                    rel="nofollow noopener"
                    href={archiveHref(basePath, 1, params, { per_page: String(choice) })}
                    className="shop-per-page__link"
                    data-current={params.per_page === String(choice) || undefined}
                  >
                    <span> {choice} </span>
                  </Link>
                  <span className="shop-per-page__border" />
                </Fragment>
              ))}
            </div>
            <div className="shop-view">
              <Link rel="nofollow noopener" href={archiveHref(basePath, 1, params, { shop_view: "list", per_row: undefined })} className="shop-view__link" data-current={view === "list" || undefined} aria-label="List view">
                <Icon name="viewList" />
              </Link>
              <Link rel="nofollow noopener" href={archiveHref(basePath, 1, params, { shop_view: "grid", per_row: "3" })} className="shop-view__link" data-current={view === "grid-3" || undefined} aria-label="Grid view 3">
                <Icon name="viewGrid3" />
              </Link>
              <Link rel="nofollow noopener" href={archiveHref(basePath, 1, params, { shop_view: "grid", per_row: "4" })} className="shop-view__link shop-view__link--4" data-current={view === "grid-4" || undefined} aria-label="Grid view 4">
                <Icon name="viewGrid4" />
              </Link>
            </div>
            <OrderbySelect options={options} value={listing.orderby} basePath={basePath} hidden={hidden} />
          </>
        ) : null}
      </div>
    </div>
  );
}
