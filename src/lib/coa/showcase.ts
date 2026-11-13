/**
 * The homepage's "Every batch tested. Every report verifiable." certificates (the owner, 13 Nov 2026,
 * after biopeptech.id: "pop up certificates on home page"). The section's Elementor carousel (Unlimited
 * Elements "Content Carousel": one report picture and its title per item, plus the "Remote Arrows"
 * widget) becomes island "coa-showcase" (src/components/coa/CoaShowcase.tsx): a row of report cards
 * that open the certificate in a window. The pictures and titles stay the page's own (editable where the
 * homepage is edited); each is matched to the lab results page's certificate of the same name, which
 * adds the purity, lab, date, batch and the lab's links. The section's headings and its "View All
 * Reports" button are kept.
 */
import "server-only";

import type { Coa } from "@/components/coa/types";
import { domutils, Element, parse, serialize, type ChildNode } from "@/lib/content/render/html";
import type { ElementorPageData } from "@/lib/elementor/pages";

export type ShowcaseItem = { id: string; title: string; image: string; coa: Coa | null };
export type CoaShowcaseProps = { items: ShowcaseItem[] };

const textOf = (node: ChildNode) => domutils.textContent(node).replace(/\s+/g, " ").trim();
const hasClass = (node: Element, name: string) => (node.attribs.class ?? "").split(/\s+/).includes(name);
/** "BPC-157 10MG /TB-500 10MG 20MG blend" and "BPC-15710MG/TB-50010MG 20MG blend" → the same key. */
const nameKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The top-level section that holds a node. */
function topSection(node: Element): Element | null {
  let found: Element | null = null;
  for (let el: Element | null = node; el; el = el.parent instanceof Element ? el.parent : null) {
    if (el.name === "section" && hasClass(el, "elementor-top-section")) found = el;
  }
  return found;
}

export function withCoaShowcase(page: ElementorPageData, coas: Coa[]): ElementorPageData {
  const nodes = parse(page.html);
  const heading = domutils.findOne((el) => /^h[1-6]$/.test(el.name) && /every batch tested/i.test(textOf(el)), nodes);
  const section = heading ? topSection(heading) : null;
  if (!section) return page;
  const carousel = domutils.findOne((el) => hasClass(el, "elementor-widget-ucaddon_content_carousel_new"), section.children);
  if (!carousel) return page;
  const byName = new Map(coas.map((coa) => [nameKey(coa.title), coa]));
  const seen = new Set<string>();
  const items: ShowcaseItem[] = [];
  for (const item of domutils.findAll((el) => hasClass(el, "ue-item"), carousel.children)) {
    const link = domutils.findOne((el) => el.name === "a" && hasClass(el, "ue_img_link"), item.children);
    const titleNode = domutils.findOne((el) => hasClass(el, "ue-title"), item.children);
    const image = link?.attribs.href ?? "";
    const title = titleNode ? textOf(titleNode) : "";
    if (!image || !title || seen.has(image)) continue;
    seen.add(image);
    items.push({ id: `report-${items.length + 1}`, title, image, coa: byName.get(nameKey(title)) ?? null });
  }
  if (items.length === 0) return page;
  const slot = new Element("div", { class: "coa-showcase-slot", "data-island": "coa-showcase", "data-island-props": JSON.stringify({ items } satisfies CoaShowcaseProps) });
  domutils.replaceElement(carousel, slot);
  // The carousel's own arrows: the new row has its own.
  const arrows = domutils.findOne((el) => hasClass(el, "elementor-widget-ucaddon_arrow_navigation"), section.children);
  if (arrows) domutils.removeElement(arrows);
  return { ...page, html: serialize(nodes) };
}
