/**
 * "/": the homepage, the Elementor page copied from the live site (Phase 3d). A static page: its
 * HTML is built in advance and the same for everyone.
 *
 * "/" also answers searches on WordPress (/?s=bpc&post_type=product). Those never reach this page:
 * src/proxy.ts hands them to the product search (src/app/(store)/page/[page]/page.tsx, page 1), so
 * the homepage doesn't depend on the address's query and can stay static.
 */
// Elementor core → kit → the homepage's Elementor CSS, before the theme CSS ElementorPage imports.
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/legacy/post-7282.css";

import type { Metadata } from "next";

import { ElementorPage } from "@/components/elementor/ElementorPage";
import { HomePopups } from "@/components/elementor/HomePopups";
import { AgeGate } from "@/components/layout/AgeGate";
import { archiveMetadata } from "@/components/shop/archive-metadata";
import { getCoas } from "@/lib/coa/library";
import { withCoaShowcase } from "@/lib/coa/showcase";
import { withDispatchPanel } from "@/lib/home/dispatch";
import { getSiteChrome } from "@/lib/content/sanity";
import { getElementorPage } from "@/lib/elementor/pages";

async function getHomePage() {
  const page = await getElementorPage("home");
  if (!page) throw new Error("src/content/pages/home.json is missing: run scripts/audit/export_elementor_pages.py");
  return page;
}

export async function generateMetadata(): Promise<Metadata> {
  return archiveMetadata((await getHomePage()).seo, "/");
}

export default async function HomePage() {
  return (
    <>
      {/* The hero's button becomes the dispatch countdown + format tiles (src/lib/home/dispatch.ts); the
          certificates carousel opens each report in a window (src/lib/coa/showcase.ts). */}
      <ElementorPage page={withCoaShowcase(withDispatchPanel(await getHomePage()), await getCoas())} />
      {/* On the live site the age gate and the "5% off" popups are on the homepage only (Q-45). */}
      <AgeGate ageGate={(await getSiteChrome()).ageGate} />
      <HomePopups />
    </>
  );
}
