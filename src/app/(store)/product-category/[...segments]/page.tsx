/**
 * Category pages: /product-category/vial/, /product-category/vial/healing-recovery/ and their
 * following pages (/product-category/vial/page/2/). Products of sub-categories are included.
 * With archive arguments (?orderby=date…) src/proxy.ts serves …/view/orderby%3Ddate/ (VIEW_SEGMENT),
 * so this route never reads the query.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { archiveMetadata } from "@/components/shop/archive-metadata";
import { parsePageSegment, ShopArchive, type Crumb } from "@/components/shop/ShopArchive";
import { paramsFromView, VIEW_SEGMENT } from "@/components/shop/shop-url";
import { defaultPerPage, getCategories, getCategoryBySegments, getCategoryTrail, getListing } from "@/lib/catalog";

// Every page of this route is prerendered (generateStaticParams), so opening one from a link only
// fetches a ready-made page. Next.js 16 still asks for <Suspense> around `params`; the live site
// reloads the whole page on each click anyway, so this route is allowed to wait instead.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

// A category made (or moved) in /admin/categories/ after the build, a page number added by new
// products, and a sorted view aren't prerendered. By default Next.js would answer them with the route's
// App Shell ("Page Not Found", noindex) for good; "navigation" makes the first visit wait for the
// complete page, which is then kept like the prerendered ones.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md
export const ensureStatic = "navigation";

/** Splits [..."vial", "page", "2", "view", "orderby=date"] into the category, the page and the arguments. */
async function resolve(segments: string[]) {
  let rest = segments;
  let view = {};
  if (rest.length >= 3 && rest.at(-2) === VIEW_SEGMENT) {
    view = paramsFromView(rest.at(-1));
    rest = rest.slice(0, -2);
  }
  let page = 1;
  if (rest.length >= 3 && rest.at(-2) === "page") {
    const parsed = parsePageSegment(rest.at(-1));
    if (!parsed) return null;
    page = parsed;
    rest = rest.slice(0, -2);
  }
  const category = await getCategoryBySegments(rest);
  return category ? { category, page, view } : null;
}

/** Prerender every category, and its extra pages at the default 21 products per page. */
export async function generateStaticParams() {
  const all = await Promise.all(
    (await getCategories()).map(async (category) => {
      const base = category.path.split("/").filter(Boolean).slice(1); // drop "product-category"
      const pages = (await getListing({ category, perPage: defaultPerPage })).totalPages;
      return [{ segments: base }, ...Array.from({ length: pages - 1 }, (_, i) => ({ segments: [...base, "page", String(i + 2)] }))];
    }),
  );
  return all.flat();
}

export async function generateMetadata({ params }: PageProps<"/product-category/[...segments]">): Promise<Metadata> {
  const resolved = await resolve((await params).segments);
  if (!resolved) notFound();
  const { category, page } = resolved;
  return archiveMetadata(category.seo, page > 1 ? `${category.path}page/${page}/` : category.path);
}

export default async function CategoryPage({ params }: PageProps<"/product-category/[...segments]">) {
  const resolved = await resolve((await params).segments);
  if (!resolved) notFound();
  const { category, page, view } = resolved;
  const trail = await getCategoryTrail(category);
  const crumbs: Crumb[] = [
    { label: "Home", href: "/" },
    ...trail.slice(0, -1).map((c) => ({ label: c.name, href: c.path })),
    { label: category.name },
  ];
  const pages = (await getListing({ category, perPage: defaultPerPage })).totalPages;
  return (
    <>
      {page > 1 ? <link rel="prev" href={page === 2 ? category.path : `${category.path}page/${page - 1}/`} /> : null}
      {page < pages ? <link rel="next" href={`${category.path}page/${page + 1}/`} /> : null}
      <ShopArchive
        title={category.title}
        crumbs={crumbs}
        basePath={category.path}
        page={page}
        category={category}
        searchParams={Promise.resolve(view)}
      />
    </>
  );
}
