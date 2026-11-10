/**
 * A WordPress page built with Elementor (the homepage and the 52 landing pages), in the same frame
 * the live theme prints around it:
 *
 *   main.wd-content-layout.container > div.wd-content-area > article.entry-content > the document
 *
 * (plus div.elementor-page-width around it, which only measures the page width for Elementor's
 * "stretched" sections: see src/styles/elementor-page.css).
 *
 * CSS order (it decides which of two equally strong rules wins):
 *   1. Elementor core and 2. the Elementor "kit" are imported by the route BEFORE this component,
 *      because the order of imports is the order of the CSS;
 *   3. the homepage's own Elementor CSS (src/styles/legacy/post-7282.css) is imported by its route
 *      too, after the kit, as on the live site;
 *   4. the theme's CSS (the imports below);
 *   5. a landing page's own Elementor CSS (public/legacy/elementor/post-<id>.css, `linkedStyles`),
 *      linked at the start of the page: one file per page can't be imported by the route all 52
 *      share. The live site loads it before the theme, but its rules are far more specific than the
 *      theme's (".elementor-1588 .elementor-element.elementor-element-…"), so the result is the same;
 *   6. the plugins' stylesheets (Owl Carousel, Trustindex…), linked from inside the content.
 *
 * Pages with the theme's default template (/insights/) also get its black title band on top.
 */
import "@/styles/shop.css";
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";

import { ScrollbarWidth } from "@/components/product/ScrollbarWidth";
import { JsonLd } from "@/components/seo/JsonLd";
import type { ElementorPageData } from "@/lib/elementor/pages";

import { ElementorContent, ElementorFragment } from "./ElementorContent";
import { PluginScripts } from "./PluginScripts";

/** Elementor documents whose CSS is never linked: the kit (bundled), the site footer and the top-bar
 * marquee (rebuilt natively), the popups (the age gate is rebuilt natively). */
const NOT_LINKED = new Set([7, 267, 4118, 5869, 5870, 6534]);

export function ElementorPage({ page, linkedStyles = false }: { page: ElementorPageData; linkedStyles?: boolean }) {
  return (
    <div className="elementor-page-width">
      {/* Plain links (no "precedence"), so React leaves them here instead of moving them into <head>,
          and removes them again when the visitor leaves the page. */}
      {linkedStyles
        ? page.stylesheets
            .filter((id) => !NOT_LINKED.has(id))
            .map((id) => <link key={id} rel="stylesheet" href={`/legacy/elementor/post-${id}.css`} />)
        : null}      <JsonLd path={page.path} />
      {page.pageTitleHtml ? <ElementorFragment html={page.pageTitleHtml} /> : null}
      <main id="main-content" className="wd-content-layout content-layout-wrapper container elementor-page elementor-kit-7">
        <div className="wd-content-area site-content">
          <article id={`post-${page.docId}`} className={page.articleClass} data-legacy-html="">
            <ElementorContent html={page.html} path={page.path} />
          </article>
        </div>
      </main>
      {/* The owner's plugin tools (/calculator/): their configuration, then their script. */}
      {page.toolConfig ? <script id="arp-tools-config" type="application/json" dangerouslySetInnerHTML={{ __html: page.toolConfig.replace(/</g, "\\u003c") }} /> : null}
      {page.toolScripts?.length ? <PluginScripts srcs={page.toolScripts} /> : null}
      <ScrollbarWidth />
    </div>
  );
}
