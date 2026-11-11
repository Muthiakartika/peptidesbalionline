/**
 * /protocol-builder/: the owner's "Atlas Research Planner" (plugin 1.7.1, GPL-2.0-or-later), as on
 * the live site. A plain WordPress page with the theme's title band ("Protocol Builder", Home /
 * Protocol Builder) and the plugin's markup in its <article>: the intro, the three steps, an empty
 * box where the builder appears, "How the calculation works", the questions and the disclaimer.
 * The builder itself is the plugin's own script (public/legacy/vendor/atlas-research-planner/
 * planner.js, unchanged), which reads its configuration from <script id="arp-config"> and talks
 * to this site's copy of the plugin's API (src/app/api/atlas-planner/v1/).
 *
 * Its own route (not the page content system): the markup, texts and SEO come from the snapshot
 * src/content/planner/page.json (scripts/planner/export-planner-data.mjs), so it renders the same
 * with CONTENT_SOURCE=sanity, where the page doesn't exist. It is built in advance (no visitor data:
 * the script asks GET /session for that), and an unknown address still gets the real 404.
 */
// The same CSS, in the same order, as the other pages copied from WordPress (the landing route and
// src/components/elementor/ElementorPage.tsx); the plugin's planner.css is linked inside the article,
// as on live.
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/shop.css";
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";

import type { Metadata } from "next";

import { ElementorFragment } from "@/components/elementor/ElementorContent";
import { PluginScripts } from "@/components/elementor/PluginScripts";
import { PlannerCartBridge } from "@/components/planner/PlannerCartBridge";
import { ScrollbarWidth } from "@/components/product/ScrollbarWidth";
import { JsonLd } from "@/components/seo/JsonLd";
import { archiveMetadata } from "@/components/shop/archive-metadata";
import { plannerArticleHtml, plannerPage } from "@/lib/planner/config";

export const metadata: Metadata = archiveMetadata(plannerPage.seo, plannerPage.path);

/** The plugin's script; "?ver=" as on live, so a new copy is never read from an old cache. */
const PLANNER_SCRIPTS = [`/legacy/vendor/atlas-research-planner/planner.js?ver=${plannerPage.assetVersion}`];

export default function ProtocolBuilderPage() {
  return (
    <div className="elementor-page-width">
      <JsonLd path={plannerPage.path} />
      <ElementorFragment html={plannerPage.pageTitleHtml} />
      <main id="main-content" className="wd-content-layout content-layout-wrapper container elementor-page elementor-kit-7">
        <div className="wd-content-area site-content">
          {/* The plugin's markup exactly as live prints it. React never changes it after the first
              render, so the plugin's script can draw the builder inside it. */}
          <article id={`post-${plannerPage.postId}`} className={plannerPage.articleClass} data-legacy-html="" dangerouslySetInnerHTML={{ __html: plannerArticleHtml() }} />
        </div>
      </main>
      <PluginScripts srcs={PLANNER_SCRIPTS} />
      <PlannerCartBridge />
      <ScrollbarWidth />
    </div>
  );
}
