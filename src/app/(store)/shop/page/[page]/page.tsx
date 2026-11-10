/** /shop/page/2/ … /shop/page/9/ : the following pages of the shop (src/components/shop/ShopPagedPage.tsx). */
import type { Metadata } from "next";

import { ShopPagedPage, shopPagedMetadata, shopPagedParams } from "@/components/shop/ShopPagedPage";

// Every page of this route is prerendered (generateStaticParams), so opening one from a link only
// fetches a ready-made page. Next.js 16 still asks for <Suspense> around `params`; the live site
// reloads the whole page on each click anyway, so this route is allowed to wait instead.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

// A page number added by products made after the build isn't prerendered: "navigation" makes its
// first visit wait for the complete page instead of the route's App Shell ("Page Not Found", noindex).
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md
export const ensureStatic = "navigation";

export const generateStaticParams = shopPagedParams;

export async function generateMetadata({ params }: PageProps<"/shop/page/[page]">): Promise<Metadata> {
  return shopPagedMetadata((await params).page);
}

export default async function Page({ params }: PageProps<"/shop/page/[page]">) {
  return <ShopPagedPage segment={(await params).page} />;
}
