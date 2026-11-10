/**
 * /shop/page/2/?orderby=date … : a following page of the shop with archive arguments, which
 * src/proxy.ts serves from here (/shop/page/2/view/orderby%3Ddate/; that address itself is a 404).
 */
import type { Metadata } from "next";

import { ShopPagedPage, shopPagedMetadata } from "@/components/shop/ShopPagedPage";

export const instant = false;

// Each combination is made on its first visit (which waits for the complete page) and then kept.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md
export const ensureStatic = "navigation";

/** One combination in advance ("navigation" needs a complete set); the others on their first visit. */
export function generateStaticParams() {
  return [{ page: "2", view: "orderby=date" }];
}

export async function generateMetadata({ params }: PageProps<"/shop/page/[page]/view/[view]">): Promise<Metadata> {
  return shopPagedMetadata((await params).page);
}

export default async function Page({ params }: PageProps<"/shop/page/[page]/view/[view]">) {
  const { page, view } = await params;
  return <ShopPagedPage segment={page} view={view} />;
}
