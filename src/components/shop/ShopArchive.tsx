/**
 * The page shared by /shop/, every /product-category/…/ page and the product search results
 * (Woodmart layout #9495 on the live site):
 *
 *   ┌ grey title band ─ title + breadcrumbs │ round category images ┐
 *   ├ category sidebar │ toolbar, product grid, page numbers        ┤
 *
 * The title band only depends on the URL path, so Next.js can prerender it. Everything below
 * depends on the query string (?orderby=, ?per_page=, ?shop_view=…), which is only known when a
 * visitor asks for the page, so it is rendered per request inside <Suspense>.
 */
import "@/styles/shop.css";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";

import { AliasNotice } from "@/components/layout/search/AliasNotice";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCategoryTree, getListing, normalisePerPage, type Category, type CategoryTile } from "@/lib/catalog";
import { shortDescriptionFor } from "@/lib/catalog/product-content";
import { getProductPage } from "@/lib/catalog/product-page";
import { cleanLegacyHtml } from "@/lib/legacy-html";

import { CategoryCarousel } from "./CategoryCarousel";
import { CategorySidebar } from "./CategorySidebar";
import { Pagination } from "./Pagination";
import { ProductCard } from "./ProductCard";
import { ShopToolbar } from "./ShopToolbar";
import { archiveHref, pickArchiveParams } from "./shop-url";

export type Crumb = { label: string; href?: string };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type ShopArchiveProps = {
  title: string;
  crumbs: Crumb[];
  tiles: CategoryTile[];
  /** First page of this archive: "/shop/", "/product-category/vial/" or "/" (search). */
  basePath: string;
  page: number;
  category?: Category;
  search?: string;
  searchParams: SearchParams;
};

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="shop-breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="contents">
          {index > 0 ? <span className="shop-breadcrumbs__delimiter" /> : null}
          {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span className="shop-breadcrumbs__last">{crumb.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ShopArchive(props: ShopArchiveProps) {
  const { title, crumbs, tiles } = props;
  return (
    <main id="main-content" className="shop-archive">
      {/* The search results ("/") have no structured data of their own. */}
      {props.search === undefined ? <JsonLd path={props.page > 1 ? `${props.basePath}page/${props.page}/` : props.basePath} /> : null}
      <section className="shop-band">
        <div className="shop-band__container">
          <div className="shop-band__title-col">
            <div className="shop-band__title-wrap">
              <h1 className="shop-band__title">{title}</h1>
              <Breadcrumbs crumbs={crumbs} />
            </div>
          </div>
          <div className="shop-band__tiles-col">
            <div className="shop-band__tiles-wrap">{tiles.length > 0 ? <CategoryCarousel tiles={tiles} /> : null}</div>
          </div>
        </div>
      </section>
      <Suspense fallback={<section className="shop-body" aria-busy="true" />}>
        <ShopBody {...props} />
      </Suspense>
    </main>
  );
}

async function ShopBody({ basePath, page, category, search, searchParams }: ShopArchiveProps) {
  const params = pickArchiveParams(await searchParams);
  const perPage = normalisePerPage(params.per_page);
  const listing = await getListing({ category, search, orderby: params.orderby, page, perPage });
  // /shop/page/99/ does not exist. The page number can only be checked here, because ?per_page=
  // changes how many pages there are; the 404 then streams in (with a noindex tag) instead of
  // being a real 404 status. Open pagination links always point to existing pages.
  if (page > listing.totalPages) notFound();
  const isList = params.shop_view === "list";
  const perRow = params.shop_view === "grid" && Number(params.per_row) > 0 ? Number(params.per_row) : 3;
  // The list view also shows each product's short description (its product page's; from Sanity when
  // the site reads Sanity).
  const shortDescriptions = isList ? await Promise.all(listing.products.map(async (product) => shortDescriptionFor(await getProductPage(product.path), product.path))) : [];

  return (
    <section className="shop-body">
      <div className="shop-body__container">
        <div className="shop-body__row">
          <CategorySidebar tree={await getCategoryTree()} currentId={category?.id} />
          <div className="shop-main">
            <div className="shop-main__wrap">
              <ShopToolbar listing={listing} perPage={perPage} basePath={basePath} params={params} isSearch={search !== undefined} />
              <div className="shop-products">
                {/* Product search: the compound-name note above the products, as the owner's script
                    puts it on the live site. */}
                {search !== undefined ? <AliasNotice query={search} /> : null}
                {listing.total > 0 ? (
                  <>
                    <div className="product-grid" data-view={isList ? "list" : "grid"} style={{ "--cols": perRow } as CSSProperties}>
                      {listing.products.map((product, index) =>
                        isList ? (
                          <ProductCard key={product.id} product={product} view="list" shortDescription={cleanLegacyHtml(shortDescriptions[index]) || null} />
                        ) : (
                          <ProductCard key={product.id} product={product} />
                        ),
                      )}
                    </div>
                    <Pagination current={listing.page} total={listing.totalPages} hrefFor={(n) => archiveHref(basePath, n, params)} />
                  </>
                ) : (
                  <NoProducts search={search} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** WooCommerce's "no products" notice, followed by a product search box (Woodmart). */
function NoProducts({ search }: { search?: string }): ReactNode {
  return (
    <>
      <div className="shop-no-products">
        <div className="shop-notice" role="status">
          No products were found matching your selection.
        </div>
      </div>
      <div className="shop-no-products__footer">
        <form role="search" method="get" action="/" className="shop-no-products__search" autoComplete="off">
          <input type="text" name="s" required placeholder="Search for products" aria-label="Search" title="Search for products" defaultValue={search} />
          <input type="hidden" name="post_type" value="product" />
          <button type="submit">
            <span> Search </span>
          </button>
        </form>
      </div>
    </>
  );
}

/** Checks a /page/N/ segment: whole number ≥ 2 (page 1 has no /page/1/ URL). */
export function parsePageSegment(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return page >= 2 ? page : null;
}
