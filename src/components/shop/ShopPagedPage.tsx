/**
 * /shop/page/2/ … : the shop's following pages, for /shop/page/[page]/ and, with archive arguments
 * (src/proxy.ts: /shop/page/2/?orderby=date → /shop/page/2/view/orderby%3Ddate/), for
 * /shop/page/[page]/view/[view]/. Neither reads the query, so every page stays static.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { defaultPerPage, getListing, getShopSeo } from "@/lib/catalog";

import { archiveMetadata } from "./archive-metadata";
import { parsePageSegment, ShopArchive } from "./ShopArchive";
import { paramsFromView } from "./shop-url";

/** The pages that exist with the default 21 products per page (at least page 2, which is a 404 when
 * the shop has one page: "navigation" needs one complete set). */
export async function shopPagedParams(): Promise<{ page: string }[]> {
  const pages = (await getListing({ perPage: defaultPerPage })).totalPages;
  return Array.from({ length: Math.max(1, pages - 1) }, (_, i) => ({ page: String(i + 2) }));
}

export function shopPagedMetadata(segment: string): Metadata {
  const page = parsePageSegment(segment);
  if (!page) notFound();
  // Yoast keeps the same title and description on every page; the canonical is the page itself.
  return archiveMetadata(getShopSeo(), `/shop/page/${page}/`);
}

export async function ShopPagedPage({ segment, view }: { segment: string; view?: string }) {
  const page = parsePageSegment(segment);
  if (!page) notFound();
  const pages = (await getListing({ perPage: defaultPerPage })).totalPages;
  return (
    <>
      <link rel="prev" href={page === 2 ? "/shop/" : `/shop/page/${page - 1}/`} />
      {page < pages ? <link rel="next" href={`/shop/page/${page + 1}/`} /> : null}
      <ShopArchive
        title="Shop"
        crumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
        basePath="/shop/"
        page={page}
        searchParams={Promise.resolve(paramsFromView(view))}
      />
    </>
  );
}
