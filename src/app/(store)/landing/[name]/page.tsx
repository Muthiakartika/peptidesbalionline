/**
 * The pages copied from the live site other than the homepage: the 52 Elementor landing pages
 * (Phase 3e: /bpc-157-bali/, /bpc-157-bali-price/, /fat-loss-peptides-bali/, /peptides-canggu/,
 * /peptide/jakarta/, …), /insights/ (3f) and the 20 information, legal and affiliate pages (3g:
 * /about-atlas-longevity/, /privacy-policy/, /affiliate-login/, …; four of them are plain WordPress
 * pages without Elementor). The list: src/content/pages/index.ts.
 *
 * Visitors never see this route's own address (/landing/<name>/): src/proxy.ts sends each landing
 * page's real address here, e.g. /peptide/jakarta/ -> /landing/peptide-jakarta/, and the address bar
 * keeps showing /peptide/jakarta/. Why not a catch-all route at the real addresses: that route also
 * answers every unknown address, and with Cache Components an unknown address would then get the
 * 404 page with status 200 ("soft 404"). This way every landing page is built in advance, and the
 * catch-all (src/app/(store)/[...slug]/page.tsx) still answers unknown addresses with a real 404.
 */
// AffiliateWP's form styles → Elementor core → kit, before the theme CSS that ElementorPage imports
// (see ElementorPage.tsx): the live site loads the plugin's styles before the theme's, so the theme
// wins where both style a field.
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ElementorPage } from "@/components/elementor/ElementorPage";
import { InsightsPage } from "@/components/insights/InsightsPage";
import { withCoaLibrary } from "@/lib/coa/library";
import { archiveMetadata } from "@/components/shop/archive-metadata";
import { getElementorPage, landingPageNames } from "@/lib/elementor/pages";

// Every page of this route is prerendered (generateStaticParams), so opening one from a link only
// fetches a ready-made page. Next.js 16 still asks for <Suspense> around `params`; the live site
// reloads the whole page on each click anyway, so this route is allowed to wait instead.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

export function generateStaticParams() {
  return landingPageNames.map((name) => ({ name }));
}

async function getLandingPage(params: PageProps<"/landing/[name]">["params"]) {
  const { name } = await params;
  return name === "home" ? null : getElementorPage(name);
}

export async function generateMetadata({ params }: PageProps<"/landing/[name]">): Promise<Metadata> {
  const page = await getLandingPage(params);
  if (!page) notFound();
  return archiveMetadata(page.seo, page.path);
}

export default async function LandingPage({ params }: PageProps<"/landing/[name]">) {
  const page = await getLandingPage(params);
  if (!page) notFound();
  // /insights/ has its own design since 11 Nov 2026 (src/components/insights/InsightsPage.tsx);
  // only its SEO texts still come from the page content.
  if (page.family === "blog" || page.path === "/insights/") return <InsightsPage page={page} />;
  // The lab results page: its COA cards become the interactive COA library (src/lib/coa/library.ts).
  if (page.path === "/lab-results-certificates-of-analysis/") return <ElementorPage page={withCoaLibrary(page)} linkedStyles />;
  return <ElementorPage page={page} linkedStyles />;
}
