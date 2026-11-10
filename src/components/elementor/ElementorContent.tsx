/**
 * Shows an Elementor document copied from the live site with its original markup (so its own CSS,
 * src/styles/legacy/post-<id>.css, applies unchanged), turned into React elements on the server.
 *
 * A few widgets did their job with the live site's JavaScript. Those are swapped for components of
 * this project ("islands"), found by the marks scripts/audit/export_elementor_pages.py put on them
 * or by their Elementor widget type:
 *   * Woodmart product grids      -> ProductGridIsland (cards from the catalogue, with quick shop);
 *   * the Owl Carousel + its arrows (Unlimited Elements) -> OwlCarousel, RemoteArrows;
 *   * counters -> ElementorCounter; the testimonial carousel -> TestimonialCarousel (Swiper);
 *   * the gallery -> ElementorGallery; the two search boxes -> ElementorSearch;
 *   * the Google reviews slider (Trustindex) -> TrustindexReviews;
 *   * the accordions (Woodmart FAQ blocks, Unlimited Elements "Content Accordion", Elementor's
 *     "Toggle") -> WoodmartAccordion, ContentAccordion, ElementorToggle;
 *   * the blog widget on /insights/ -> BlogGridIsland (the posts from the blog data);
 *   * forms that send their answers to WordPress (contact, consultation, affiliate) -> PendingForm,
 *     which holds the sending back until something receives them (Q-12, Q-43);
 *   * the "copy" icons after the codes on the lab results page -> CopyIcon.
 * Everything else stays exactly as WordPress printed it, except links to "javascript:void(0)"
 * (the Content Accordion's titles), which React refuses to print: they point to "#" instead, and
 * the accordion cancels the click.
 */
import parse, { attributesToProps, domToReact, Element, type DOMNode, type HTMLReactParserOptions } from "html-react-parser";

import { cleanLegacyHtml } from "@/lib/legacy-html";

import { BlogGridIsland, type BlogGridProps } from "../blog/BlogGridIsland";
import { ContentAccordion, ElementorToggle, WoodmartAccordion } from "./Accordions";
import { CopyIcon } from "./CopyIcon";
import { ElementorCounter } from "./ElementorCounter";
import { ElementorGallery } from "./ElementorGallery";
import { ElementorSearch } from "./ElementorSearch";
import { OwlCarousel } from "./OwlCarousel";
import { PendingForm } from "./PendingForm";
import { ProductGridIsland, type ProductGridProps } from "./ProductGridIsland";
import { RemoteArrows } from "./RemoteArrows";
import { TestimonialCarousel } from "./TestimonialCarousel";
import { TrustindexReviews } from "./TrustindexReviews";

const hasClass = (node: Element, name: string) => (node.attribs.class ?? "").split(/\s+/).includes(name);
const withoutClass = (classes: string | undefined, name: string) => (classes ?? "").split(/\s+/).filter((c) => c && c !== name).join(" ");

/** The nearest ancestor with the class (like Element.closest in the browser). */
function closest(node: Element, name: string): Element | null {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent instanceof Element && hasClass(parent, name)) return parent;
  }
  return null;
}

/** The element's attributes as React props, without the export marks. */
function props(node: Element, ...drop: string[]) {
  const attribs = { ...node.attribs };
  for (const name of drop) delete attribs[name];
  return attributesToProps(attribs, node.name);
}

const optionsFor = (path: string): HTMLReactParserOptions => ({
  replace(node) {
    if (!(node instanceof Element)) return undefined;
    const attribs = node.attribs;
    const children = () => domToReact(node.children as DOMNode[], optionsFor(path));
    const Tag = node.name as "div";

    if (attribs["data-island"] === "product-grid") {
      const grid = JSON.parse(attribs["data-island-props"]) as ProductGridProps;
      return (
        <Tag {...props(node, "data-island", "data-island-props")}>
          <ProductGridIsland {...grid} />
        </Tag>
      );
    }
    if (attribs["data-island"] === "blog-grid") {
      const grid = JSON.parse(attribs["data-island-props"]) as BlogGridProps;
      return (
        <Tag {...props(node, "data-island", "data-island-props")}>
          <BlogGridIsland {...grid} sharePath={path} />
        </Tag>
      );
    }
    if (attribs["data-owl-options"]) {
      return (
        <OwlCarousel id={attribs.id} className={attribs.class ?? ""} options={JSON.parse(attribs["data-owl-options"])}>
          {children()}
        </OwlCarousel>
      );
    }
    if (attribs["data-carousel-target"]) {
      return (
        <RemoteArrows target={attribs["data-carousel-target"]} attributes={props(node, "data-carousel-target")}>
          {children()}
        </RemoteArrows>
      );
    }
    if (node.name === "pre" && hasClass(node, "ti-widget")) {
      // The plugin prints the reviews inside <pre class="ti-widget"> and its script unwraps them.
      return <>{children()}</>;
    }
    if (node.name === "div" && hasClass(node, "ti-widget")) {
      // Printed invisible ("opacity:0; height:0") until the plugin's CSS has loaded; its script then
      // removes that. Here the stylesheet <link> just before it has loaded by the time it shows.
      return (
        <Tag {...props(node, "style")} data-trustindex-widget="true">
          {children()}
        </Tag>
      );
    }
    if (hasClass(node, "ti-widget-container")) {
      // Settings sit on the plugin's outer element (div.ti-widget).
      const widget = closest(node, "ti-widget");
      return (
        <TrustindexReviews
          className={attribs.class}
          reviewWidth={Number(widget?.attribs["data-review-target-width"] ?? 300)}
          autoplaySeconds={Number(widget?.attribs["data-pager-autoplay-timeout"] ?? 6)}
        >
          {children()}
        </TrustindexReviews>
      );
    }
    // Classes Elementor's carousel script adds when it starts (the column's one gives it its width).
    // Printed from the start here, so nothing moves when the carousel starts.
    if (hasClass(node, "elementor-widget-wrap") && node.children.some((child) => child instanceof Element && hasClass(child, "elementor-widget-testimonial-carousel"))) {
      return <Tag {...props(node)} className={`${attribs.class} e-swiper-container`}>{children()}</Tag>;
    }
    if (hasClass(node, "elementor-widget-testimonial-carousel")) {
      return <Tag {...props(node)} className={`${attribs.class} e-widget-swiper`}>{children()}</Tag>;
    }
    if (hasClass(node, "elementor-main-swiper") && closest(node, "elementor-widget-testimonial-carousel")) {
      const widget = closest(node, "elementor-widget-testimonial-carousel");
      return (
        <TestimonialCarousel attributes={props(node)} settings={JSON.parse(widget?.attribs["data-settings"] ?? "{}")}>
          {children()}
        </TestimonialCarousel>
      );
    }
    if (hasClass(node, "elementor-gallery__container")) {
      const widget = closest(node, "elementor-widget-gallery");
      return (
        <ElementorGallery widgetId={widget?.attribs["data-id"] ?? ""} className={attribs.class} settings={JSON.parse(widget?.attribs["data-settings"] ?? "{}")}>
          {children()}
        </ElementorGallery>
      );
    }
    if (hasClass(node, "elementor-widget-search")) {
      return <ElementorSearch attributes={props(node)}>{children()}</ElementorSearch>;
    }
    // Inside the search widget, as Elementor's script leaves it: the form shown, and no "clear" icon.
    if (node.name === "search" && hasClass(node, "e-search")) {
      return <Tag {...props(node)} className={withoutClass(attribs.class, "hidden")}>{children()}</Tag>;
    }
    if (node.name === "input" && hasClass(node, "e-search-input")) {
      return <input {...props(node)} className={`${attribs.class} no-icon-clear`} />;
    }
    if (node.name === "div" && hasClass(node, "wd-accordion")) {
      return <WoodmartAccordion attributes={props(node)}>{children()}</WoodmartAccordion>;
    }
    if (node.name === "div" && hasClass(node, "elementor-toggle")) {
      return <ElementorToggle attributes={props(node)}>{children()}</ElementorToggle>;
    }
    // Forms that post their answers to WordPress (the search forms, sent with GET, keep working).
    if (node.name === "form" && (attribs.method ?? "").toLowerCase() === "post") {
      return <PendingForm attributes={props(node, "action")}>{children()}</PendingForm>;
    }
    if (hasClass(node, "uc_material_accordion")) {
      // "uc-inited": the class the widget's script adds when it starts.
      return (
        <ContentAccordion
          attributes={{ ...props(node), className: `${attribs.class} uc-inited` }}
          closeOthers={attribs["data-closeothers"] === "true"}
          duration={Number(attribs["data-transition-duration"] ?? 400)}
        >
          {children()}
        </ContentAccordion>
      );
    }
    if (node.name === "span" && hasClass(node, "copy-icon")) {
      return <CopyIcon attributes={props(node)}>{children()}</CopyIcon>;
    }
    if (node.name === "a" && /^\s*javascript:/i.test(attribs.href ?? "")) {
      return <a {...props(node)} href="#">{children()}</a>;
    }
    if (hasClass(node, "elementor-counter-number")) {
      return (
        <ElementorCounter
          from={Number(attribs["data-from-value"] ?? 0)}
          to={Number(attribs["data-to-value"] ?? 0)}
          duration={Number(attribs["data-duration"] ?? 2000)}
          delimiter={attribs["data-delimiter"] ?? ""}
        />
      );
    }
    return undefined;
  },
});

/** `path`: the page's address (the blog widget's share links point to it). */
export function ElementorContent({ html, path = "/" }: { html: string; path?: string }) {
  return <>{parse(cleanLegacyHtml(html), optionsFor(path))}</>;
}

/** Other HTML the live page printed around the content (the theme's title band), cleaned the same way. */
export function ElementorFragment({ html }: { html: string }) {
  return <>{parse(cleanLegacyHtml(html))}</>;
}
