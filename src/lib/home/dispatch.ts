/**
 * The homepage hero's "SHOP PEPTIDES" button becomes the dispatch panel (the owner, 13 Nov 2026, after
 * biopeptech.id: "On the header I'd like something similar like this to replace the shop now button"):
 * a countdown to today's same-day cut-off (5 PM Bali time, as the site says everywhere) and a tile per
 * format (vials, pens, nasal sprays) with the menu's pictures. Island "dispatch-panel",
 * src/components/home/DispatchPanel.tsx. The rest of the hero (Elementor, editable) is unchanged.
 */
import "server-only";

import { domutils, Element, parse, serialize } from "@/lib/content/render/html";
import type { ElementorPageData } from "@/lib/elementor/pages";

export type DispatchTile = { label: string; cta: string; href: string; image: string };
export type DispatchPanelProps = { cutoffHour: number; tiles: DispatchTile[] };

/** Same-day dispatch for orders before this hour, Bali time (the top bar: "same-day Bali dispatch before 5 PM"). */
export const CUTOFF_HOUR = 17;

export const DISPATCH_TILES: DispatchTile[] = [
  { label: "Vials", cta: "Shop vials", href: "/product-category/vial/", image: "/images/nav/peptide-vials.webp" },
  { label: "Pens", cta: "Shop pens", href: "/product-category/pen-peptides/", image: "/images/nav/peptide-pens.png" },
  { label: "Nasal sprays", cta: "Shop sprays", href: "/product-category/nasal-spray-peptides/", image: "/images/nav/peptide-nasal-sprays.webp" },
];

const hasClass = (node: Element, name: string) => (node.attribs.class ?? "").split(/\s+/).includes(name);

export function withDispatchPanel(page: ElementorPageData): ElementorPageData {
  const nodes = parse(page.html);
  const hero = domutils.findOne((el) => el.name === "section" && hasClass(el, "elementor-top-section"), nodes);
  if (!hero) return page;
  const button = domutils.findOne((el) => hasClass(el, "elementor-widget-button") && /shop peptides/i.test(domutils.textContent(el)), hero.children);
  if (!button) return page;
  const props: DispatchPanelProps = { cutoffHour: CUTOFF_HOUR, tiles: DISPATCH_TILES };
  domutils.replaceElement(button, new Element("div", { class: "dispatch-slot", "data-island": "dispatch-panel", "data-island-props": JSON.stringify(props) }));
  return { ...page, html: serialize(nodes) };
}
