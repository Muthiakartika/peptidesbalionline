/** /product/<slug>/ : one product (src/components/product/ProductPage.tsx). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { archiveMetadata } from "@/components/shop/archive-metadata";
import { ProductPage } from "@/components/product/ProductPage";
import { getAllProducts, getProductByPath } from "@/lib/catalog";
import { withProductContent } from "@/lib/catalog/product-content";
import { getProductPage } from "@/lib/catalog/product-page";

// Every page of this route is prerendered (generateStaticParams), so opening one from a link only
// fetches a ready-made page. Next.js 16 still asks for <Suspense> around `params`; the live site
// reloads the whole page on each click anyway, so this route is allowed to wait instead.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

// A product added in the store admin after the build isn't prerendered. By default Next.js would answer
// its first visit with the route's App Shell (metadata "Page Not Found", noindex) and build the page in
// the background; "navigation" makes that first visit wait for the complete page instead.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await getAllProducts()).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const path = `/product/${(await params).slug}/`;
  const page = await getProductPage(path);
  if (!page) notFound();
  return archiveMetadata(page.seo, path);
}

export default async function Page({ params }: PageProps<"/product/[slug]">) {
  const path = `/product/${(await params).slug}/`;
  const product = await getProductByPath(path);
  // The texts edited in Sanity (when the site reads Sanity) over the WordPress copy.
  const page = await withProductContent(await getProductPage(path), path);
  if (!product || !page) notFound();
  return <ProductPage product={product} page={page} />;
}
