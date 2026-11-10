/**
 * /shop/ : every product, 21 per page (WooCommerce shop page on the live site).
 * The layout is shared with the category and search pages: src/components/shop/ShopArchive.tsx.
 */
import type { Metadata } from "next";

import { archiveMetadata } from "@/components/shop/archive-metadata";
import { ShopArchive } from "@/components/shop/ShopArchive";
import { defaultPerPage, getListing, getShopCarousel, getShopSeo } from "@/lib/catalog";

export const metadata: Metadata = archiveMetadata(getShopSeo(), "/shop/");

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const pages = (await getListing({ perPage: defaultPerPage })).totalPages;
  return (
    <>
      {/* Yoast's rel="next" (React moves <link> tags into <head>). */}
      {pages > 1 ? <link rel="next" href="/shop/page/2/" /> : null}
      <ShopArchive
        title="Shop"
        crumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
        tiles={await getShopCarousel()}
        basePath="/shop/"
        page={1}
        searchParams={searchParams}
      />
    </>
  );
}
