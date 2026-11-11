/**
 * The COA library on /lab-results-certificates-of-analysis/ (11 Nov 2026).
 *
 * The page keeps its Elementor content (and stays editable in Sanity). Only its section of COA cards
 * is replaced at render time by the interactive library (src/components/coa/CoaLibrary.tsx): each
 * card is read into a Coa (name, purity, lab, dates, codes, links), so adding or editing a card where
 * the page is edited still shows up in the library. The page's separate "Find Your Product" search
 * section is folded into the library (its texts become the library's heading).
 *
 * A card is the smallest Elementor column holding one purity button ("99.301%") and a
 * "Verify on <lab>" link; its texts are read in order (see readCard).
 */
import "server-only";

import type { Coa, CoaLibraryIntro, CoaLibraryProps } from "@/components/coa/types";
import { domutils, Element, parse, serialize, type ChildNode } from "@/lib/content/render/html";
import { getElementorPage, type ElementorPageData } from "@/lib/elementor/pages";
import { mediaUrl } from "@/lib/media/url";


const PURITY = /^\d{2,3}(?:\.\d+)?\s*%$/;
/** The lab results page (its name in src/content/pages/index.ts). */
const COA_PAGE = "lab-results-certificates-of-analysis";
/** Freedom Diagnostics' document server (what their COA lookup opens): <server>/<search code>.pdf */
const FREEDOM_DOCUMENTS = "https://coas.freedomdiagnosticstesting.com";
const DATE = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const hasClass = (el: Element, name: string) => (el.attribs.class ?? "").split(/\s+/).includes(name);

/** Text of a node with <br> read as a space, whitespace collapsed, copy marks (⧉) dropped. */
function textOf(node: ChildNode): string {
  const parts: string[] = [];
  const walk = (n: ChildNode) => {
    if (n.type === "text") parts.push((n as unknown as { data: string }).data);
    else if (n instanceof Element) {
      if (n.name === "br") parts.push(" ");
      else if (n.name !== "script" && n.name !== "style") n.children.forEach(walk);
    }
  };
  walk(node);
  return parts.join("").replace(/⧉/g, "").replace(/\s+/g, " ").trim();
}

const purityButtons = (el: Element) => domutils.findAll((e) => hasClass(e, "elementor-button-text") && PURITY.test(textOf(e)), el.children);
const verifyLinks = (el: Element) => domutils.findAll((e) => e.name === "a" && /^verify on /i.test(textOf(e)), el.children);

/** Is `node` inside `ancestor`? */
function isInside(ancestor: Element, node: Element): boolean {
  for (let current = node.parent; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

/** The card columns: holding exactly one purity button and a "Verify on …" link (the innermost ones). */
function findCards(nodes: ChildNode[]): Element[] {
  const columns = domutils.findAll((e) => hasClass(e, "elementor-column") && purityButtons(e).length === 1 && verifyLinks(e).length > 0, nodes);
  return columns.filter((column) => !columns.some((other) => other !== column && isInside(column, other)));
}

function isoDate(label: string): string {
  const m = DATE.exec(label);
  if (!m) return "";
  const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  return month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

const sitePath = (href: string | undefined) => {
  if (!href) return null;
  try {
    const url = new URL(href, "https://peptidesbali.online");
    return url.hostname.endsWith("peptidesbali.online") ? url.pathname : href;
  } catch {
    return null;
  }
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** One card → a Coa (null when the card misses its purity or lab). */
function readCard(card: Element, index: number): Coa | null {
  const widgets = domutils.findAll((e) => /\belementor-widget-(text-editor|heading|button)\b/.test(e.attribs.class ?? ""), card.children);
  const texts = widgets.map(textOf).filter(Boolean);
  const purityAt = texts.findIndex((t) => PURITY.test(t));
  if (purityAt < 0) return null;
  const purityText = texts[purityAt].replace(/\s+/g, "");
  const heading = domutils.findOne((e) => /^h[1-6]$/.test(e.name), card.children);
  const title = heading ? textOf(heading) : texts[purityAt + 1] ?? "";
  const titleAt = texts.indexOf(title, purityAt);
  const dateAt = texts.findIndex((t) => DATE.test(t));
  // Between the title and "Tested": the compound and its amount ("Retatrutide", "10 mg").
  const between = texts.slice(titleAt + 1, dateAt > 0 ? dateAt : undefined).filter((t) => !/^test(ed|ing)?$/i.test(t));
  const after = dateAt >= 0 ? texts.slice(dateAt + 1) : [];
  const valueAfter = (label: RegExp) => {
    const i = after.findIndex((t) => label.test(t));
    if (i < 0) return null;
    const inline = after[i].replace(label, "").trim();
    return inline || after[i + 1] || null;
  };
  const task = after.map((t) => /Task\s*#\s*(\d+)\s*([A-Z0-9]{6,})?/i.exec(t)).find(Boolean);
  const searchCode = valueAfter(/^Search Code/i);
  const accession = valueAfter(/^Accession\s*#/i);
  const first = after[0];
  const batch = first && !/^(search code|view product|task\s*#|accession)/i.test(first) ? first : null;

  const links = domutils.findAll((e) => e.name === "a" && Boolean(e.attribs.href) && e.attribs.href !== "#", card.children);
  const verify = links.find((a) => /^verify on /i.test(textOf(a)));
  const report = links.find((a) => /report|pdf/i.test(textOf(a)));
  const product = links.find((a) => /\/product\//.test(a.attribs.href));
  const lab = verify ? textOf(verify).replace(/^verify on /i, "").trim() : "";
  if (!lab) return null;
  // A report that isn't a PDF we host is the lab's own verification page: use the card's verify link
  // (on live, Retatrutide 30mg's "View report PDF" pointed at the Tirzepatide test by mistake).
  const reportHref = report?.attribs.href;
  const reportUrl = reportHref && /\.pdf(?:$|[?#])/i.test(reportHref) ? mediaUrl(reportHref) : verify ? mediaUrl(verify.attribs.href) : null;
  // Freedom Diagnostics' verify link is their generic lookup page, where the visitor must type the
  // search code. Their lookup opens the certificate from the lab's own document server at
  // <server>/<search code>.pdf: link there directly, so "Verify" opens this certificate.
  const verifyHref = verify?.attribs.href ?? "";
  const verifyUrl = /freedomdiagnosticstesting\.com/i.test(verifyHref) && searchCode ? `${FREEDOM_DOCUMENTS}/${encodeURIComponent(searchCode)}.pdf` : verify ? mediaUrl(verifyHref) : null;
  const label = texts[purityAt - 1] ?? "";
  const peptide = between[0] || label || title;
  const code = task?.[1] ?? accession ?? searchCode ?? String(index + 1);

  return {
    id: `${slug(lab)}-${slug(code)}`,
    peptide,
    title: title || peptide,
    amount: between[1] ?? "",
    purity: Number.parseFloat(purityText),
    purityText,
    testedOn: dateAt >= 0 ? isoDate(texts[dateAt]) : "",
    testedLabel: dateAt >= 0 ? texts[dateAt] : "",
    lab,
    batch,
    task: task?.[1] ?? null,
    verificationKey: task?.[2] ?? null,
    searchCode,
    accession,
    verifyUrl,
    reportUrl,
    reportIsPdf: Boolean(reportUrl && /\.pdf(?:$|[?#])/i.test(reportUrl)),
    productPath: product ? sitePath(product.attribs.href) : null,
  };
}

/** The top-level section (direct child of the Elementor document) that holds `node`. */
function topSection(node: Element): Element | null {
  let current: Element | null = node;
  while (current?.parent instanceof Element) {
    if (current.parent.attribs["data-elementor-id"] !== undefined || hasClass(current.parent, "elementor")) return current;
    current = current.parent;
  }
  return null;
}

/** The "Find Your Product" search section's texts (eyebrow, heading, paragraph), then the section is dropped. */
function takeSearchSection(nodes: ChildNode[]): { section: Element | null; intro: CoaLibraryIntro } {
  const fallback = { eyebrow: "Browse Lab Results", title: "Find Your Product", text: "Use the search below or browse our collection of available Certificates of Analysis." };
  const form = domutils.findOne((e) => e.name === "form" && hasClass(e, "e-search-form"), nodes);
  const section = form ? topSection(form) : null;
  if (!section) return { section: null, intro: fallback };
  // The main heading is the h2 ("Find Your Product"); the small heading above it is the eyebrow.
  const headings = domutils.findAll((e) => /^h[1-6]$/.test(e.name), section.children);
  const heading = headings.find((h) => h.name === "h2") ?? headings.at(-1);
  const texts = domutils.findAll((e) => /\belementor-widget-(text-editor|heading)\b/.test(e.attribs.class ?? ""), section.children).map(textOf).filter(Boolean);
  const title = heading ? textOf(heading) : fallback.title;
  const titleAt = texts.indexOf(title);
  return {
    section,
    intro: {
      eyebrow: (titleAt > 0 ? texts[titleAt - 1] : texts[0]) || fallback.eyebrow,
      title,
      text: texts[titleAt + 1] || fallback.text,
    },
  };
}

/** The page with its COA cards replaced by the library island (unchanged when it has no cards). */
/** The certificates of the page's cards, each with a unique id. */
function readCoas(cards: Element[]): Coa[] {
  const coas = cards.map(readCard).filter((coa): coa is Coa => coa !== null);
  const seen = new Set<string>();
  for (const coa of coas) {
    let id = coa.id;
    for (let n = 2; seen.has(id); n++) id = `${coa.id}-${n}`;
    coa.id = id;
    seen.add(id);
  }
  return coas;
}

/** The lab results page's certificates (the e-mailed verification links are built from these). */
export async function getCoas(): Promise<Coa[]> {
  const page = await getElementorPage(COA_PAGE);
  return page ? readCoas(findCards(parse(page.html))) : [];
}

export function withCoaLibrary(page: ElementorPageData): ElementorPageData {
  const nodes = parse(page.html);
  const cards = findCards(nodes);
  if (cards.length === 0) return page;
  const coas = readCoas(cards);
  const cardsSection = topSection(cards[0]);
  if (!cardsSection) return page;
  const { section: searchSection, intro } = takeSearchSection(nodes);
  const props: CoaLibraryProps = { coas, intro };
  const slot = new Element("section", {
    id: cardsSection.attribs.id || "result",
    class: "coa-library-slot",
    "data-island": "coa-library",
    "data-island-props": JSON.stringify(props),
  });
  domutils.replaceElement(cardsSection, slot);
  if (searchSection && searchSection !== cardsSection) domutils.removeElement(searchSection);
  return { ...page, html: serialize(nodes) };
}
