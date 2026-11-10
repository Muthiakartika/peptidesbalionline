/**
 * Product search results (/?s=bpc&post_type=product and /page/2/?s=…), in the shop layout.
 * How matching and ordering work: src/lib/catalog/search.ts.
 */
import { redirect } from "next/navigation";

import { getListing, getShopCarousel } from "@/lib/catalog";

import { ShopArchive } from "./ShopArchive";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function ProductSearch({ page, searchParams }: { page: number; searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (Array.isArray(params.s) ? params.s[0] : params.s) ?? "";
  // WooCommerce jumps straight to the product when a search finds exactly one.
  if (page === 1) {
    const only = await getListing({ search: query, perPage: 2 });
    if (only.total === 1) redirect(only.products[0].path);
  }
  return (
    <ShopArchive
      title={`Search results: “${query}”`}
      crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop/" }, { label: `Search results for “${query}”` }]}
      tiles={await getShopCarousel()}
      basePath="/"
      page={page}
      search={query}
      searchParams={searchParams}
    />
  );
}
