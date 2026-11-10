/**
 * The search results, by page:
 *   * /?s=bpc&post_type=product, /page/2/?s=bpc&post_type=product: the product search (the header's
 *     search box), src/components/shop/ProductSearch.tsx;
 *   * /?s=bpc, /page/2/?s=bpc: the site search (products, posts and pages; the homepage's search
 *     boxes), src/components/blog/SiteSearch.tsx; with post_type=post only posts.
 * Page 1 is the address /?s=…, which src/proxy.ts hands to this route as /page/1/ (a visitor's own
 * /page/1/ is redirected to "/" there, as on WordPress). Without a search, /page/N/ shows the
 * homepage on the live site; src/proxy.ts sends those to "/".
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SiteSearch } from "@/components/blog/SiteSearch";
import { searchMetadata } from "@/components/shop/archive-metadata";
import { ProductSearch } from "@/components/shop/ProductSearch";
import { parsePageSegment } from "@/components/shop/ShopArchive";
import { getListing, normalisePerPage } from "@/lib/catalog";
import { SEARCH_PER_PAGE, siteSearch } from "@/lib/search/site-search";

// Only rendered on request (the page number and the search are unknown at build time). The header
// reads the current path, so this route opts out of prerendering, like the catch-all 404 route.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
/** Page 1 only comes from src/proxy.ts ("/?s=…"); otherwise the same rule as the shop's pages. */
const pageNumber = (segment: string) => (segment === "1" ? 1 : parsePageSegment(segment));
const postTypeOf = (value: string | undefined) => (value === "post" || value === "page" ? value : undefined);

/** The site search's results (not the product search). */
async function siteResults(query: Awaited<PageProps<"/page/[page]">["searchParams"]>) {
  return siteSearch({ query: first(query.s) ?? "", postType: postTypeOf(first(query.post_type)) });
}

export async function generateMetadata({ params, searchParams }: PageProps<"/page/[page]">): Promise<Metadata> {
  const page = pageNumber((await params).page);
  const query = await searchParams;
  if (!page || query.s === undefined) notFound();
  if (page === 1) return searchMetadata;
  const totalPages =
    query.post_type === "product"
      ? (await getListing({ search: first(query.s) ?? "", page, perPage: normalisePerPage(first(query.per_page)) })).totalPages
      : Math.max(1, Math.ceil((await siteResults(query)).length / SEARCH_PER_PAGE));
  if (page > totalPages) notFound();
  // Yoast's search title on the following pages: "- Page 2 of 7 - Atlas Longevity".
  return { ...searchMetadata, title: `- Page ${page} of ${totalPages} - Atlas Longevity` };
}

export default function SearchPagedPage({ params, searchParams }: PageProps<"/page/[page]">) {
  return (
    <Suspense fallback={null}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: PageProps<"/page/[page]">) {
  const page = pageNumber((await params).page);
  const query = await searchParams;
  if (!page || query.s === undefined) notFound();
  if (query.post_type === "product") return <ProductSearch page={page} searchParams={searchParams} />;
  const text = first(query.s) ?? "";
  const results = await siteResults(query);
  if (page > 1 && page > Math.ceil(results.length / SEARCH_PER_PAGE)) notFound();
  const postType = first(query.post_type);
  const search = `?s=${encodeURIComponent(text).replace(/%20/g, "+")}${postType ? `&post_type=${encodeURIComponent(postType)}` : ""}`;
  return <SiteSearch query={text} results={results} page={page} hrefFor={(n) => (n === 1 ? `/${search}` : `/page/${n}/${search}`)} />;
}
