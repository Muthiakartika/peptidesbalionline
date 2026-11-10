/**
 * Sanity content (src/lib/content/types.ts) → the Elementor HTML ElementorContent shows. For content
 * converted from WordPress the result is the live page's markup (Elementor's ids, classes, settings),
 * so the page's own Elementor CSS keeps applying; for sections and widgets an editor adds in the
 * Studio, Elementor's standard markup.
 *
 * How the parts fit (see scripts/sanity/lib/elementor.mjs, which takes WordPress HTML apart):
 *   document  <div rootAttrs> sections </div>
 *   section   its "layout" HTML, each <!--cms-slot:N--> replaced by slot N's widgets
 *   widget    <div wrapper> template with the data-cms="…" parts filled from the fields </div>
 */
import type {
  AccordionWidget,
  ButtonWidget,
  ElementorDocument,
  HeadingWidget,
  IconBoxWidget,
  IconListWidget,
  ImageWidget,
  Section,
  SectionSkin,
  SharedSection,
  SharedSectionRef,
  Slot,
  TextWidget,
  Widget,
} from "../types";
import { attrString, clearRoles, escapeText, isElement, parse, parseAttrs, parseJson, Placeholders, removeNode, rename, serialize, unwrap, withRole, wrapChildren, wrapElement, type ChildNode, type Element } from "./html";
import { imageAttrs, renderInline, renderRichText } from "./rich-text";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "div", "span", "p"]);

/** A short Elementor-style id (7 hex characters) for something an editor added. */
export function elementId(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0").slice(0, 7);
}

const WIDGET_NAMES: Record<Widget["_type"], string> = {
  elHeading: "heading",
  elText: "text-editor",
  elButton: "button",
  elImage: "image",
  elIconBox: "icon-box",
  elIconList: "icon-list",
  elAccordion: "wd_accordion",
  elRaw: "html",
};

/** Elementor's markup for widgets added in the Studio (converted widgets keep their own). */
const DEFAULT_TEMPLATES: Partial<Record<Widget["_type"], string>> = {
  elHeading: '<h2 class="elementor-heading-title elementor-size-default" data-cms="title"></h2>',
  elButton: '<a class="elementor-button elementor-button-link elementor-size-sm" data-cms="link"><span class="elementor-button-content-wrapper"><span class="elementor-button-text" data-cms="label"></span></span></a>',
  elImage: '<img class="attachment-full size-full" decoding="async" loading="lazy" data-cms="img">',
  elIconBox: '<div class="elementor-icon-box-wrapper"><div class="elementor-icon-box-content" data-cms="content"><h3 class="elementor-icon-box-title" data-cms="title titleText"></h3></div></div>',
  elIconList: '<ul class="elementor-icon-list-items" data-cms="items"></ul>',
  elAccordion: '<div class="wd-accordion wd-style-default wd-titles-left wd-opener-pos-right wd-opener-style-arrow" data-state="first" data-cms="items"></div>',
};
const DEFAULT_ICON_LIST_ITEM = '<li class="elementor-icon-list-item"><span class="elementor-icon-list-text" data-cms="text"></span></li>';
const DEFAULT_ACCORDION_ITEM =
  '<div class="wd-accordion-item"><div class="wd-accordion-title wd-role-btn" tabindex="0" data-cms="index"><div class="wd-accordion-title-text"><span data-cms="title"></span></div><span class="wd-accordion-opener"></span></div><div class="wd-accordion-content wd-entry-content" data-cms="index body"></div></div>';

function setLink(nodes: Element[], href: string | undefined, newTab: boolean | undefined, rel?: string) {
  for (const node of nodes) {
    if (node.name === "a" && !href) {
      // A picture or title without a link: drop the <a> but keep what was inside.
      if (node.attribs.class?.includes("elementor-button")) delete node.attribs.href;
      else unwrap(node);
      continue;
    }
    if (href !== undefined) node.attribs.href = href;
    if (newTab) node.attribs.target = "_blank";
    else delete node.attribs.target;
    if (rel) node.attribs.rel = rel;
    else if (rel === "") delete node.attribs.rel;
  }
}

/** Fill a template's data-cms parts. */
function fill(template: string, fillParts: (nodes: ChildNode[], put: Placeholders) => void): string {
  const nodes = parse(template);
  const placeholders = new Placeholders();
  fillParts(nodes, placeholders);
  clearRoles(nodes);
  return placeholders.fill(serialize(nodes));
}

function renderHeading(widget: HeadingWidget, template: string) {
  return fill(template, (nodes, put) => {
    for (const title of withRole(nodes, "title")) {
      if (widget.tag && HEADING_TAGS.has(widget.tag)) rename(title, widget.tag);
      put.put(title, renderInline(widget.title));
    }
  });
}

function renderButton(widget: ButtonWidget, template: string) {
  return fill(template, (nodes, put) => {
    for (const label of withRole(nodes, "label")) put.put(label, escapeText(widget.label ?? ""));
    setLink(withRole(nodes, "link"), widget.href ?? "", widget.newTab, widget.rel ?? "");
  });
}

function renderImage(widget: ImageWidget, template: string) {
  return fill(template, (nodes) => {
    const images = withRole(nodes, "img");
    for (const img of images) {
      const attrs = imageAttrs(img.attribs, widget.image);
      if (attrs) img.attribs = attrs;
      else removeNode(img);
    }
    const links = withRole(nodes, "link");
    if (links.length) setLink(links, widget.href, widget.newTab);
    else if (widget.href && images[0]?.parent) {
      // A link added in the Studio: put the picture inside it.
      wrapElement(images[0], "a", { href: widget.href, ...(widget.newTab ? { target: "_blank" } : {}) });
    }
  });
}

function renderIconBox(widget: IconBoxWidget, template: string) {
  return fill(template, (nodes, put) => {
    const titleTag = widget.titleTag && HEADING_TAGS.has(widget.titleTag) ? widget.titleTag : null;
    for (const title of withRole(nodes, "title")) if (titleTag) rename(title, titleTag);
    const holders = withRole(nodes, "titleText");
    for (const holder of holders) put.put(holder, escapeText(widget.title ?? ""));
    const description = renderInline(widget.description);
    const descriptions = withRole(nodes, "desc");
    if (descriptions.length) for (const desc of descriptions) put.put(desc, description);
    else if (description) {
      const content = withRole(nodes, "content")[0];
      if (content) {
        const [p] = parse('<p class="elementor-icon-box-description"></p>') as Element[];
        content.children.push(p);
        p.parent = content;
        put.put(p, description);
      }
    }
    const links = withRole(nodes, "link");
    if (links.length) setLink(links, widget.href, widget.newTab);
    else if (widget.href) for (const holder of holders) wrapChildren(holder, "a", { href: widget.href, ...(widget.newTab ? { target: "_blank" } : {}) });
  });
}

function renderIconList(widget: IconListWidget, template: string) {
  const items = widget.items ?? [];
  const fallback = items.find((item) => item.template)?.template ?? DEFAULT_ICON_LIST_ITEM;
  return fill(template, (nodes, put) => {
    const html = items
      .map((item) =>
        fill(item.template ?? fallback, (itemNodes, itemPut) => {
          for (const text of withRole(itemNodes, "text")) itemPut.put(text, escapeText(item.text ?? ""));
          const links = withRole(itemNodes, "link");
          if (links.length) setLink(links, item.href, item.newTab);
          else if (item.href) {
            const li = itemNodes.find(isElement);
            if (li) wrapChildren(li, "a", { href: item.href, ...(item.newTab ? { target: "_blank" } : {}) });
          }
        }),
      )
      .join("\n");
    for (const list of withRole(nodes, "items")) put.put(list, html);
  });
}

function renderAccordion(widget: AccordionWidget, template: string) {
  const items = widget.items ?? [];
  const fallback = items.find((item) => item.template)?.template ?? DEFAULT_ACCORDION_ITEM;
  return fill(template, (nodes, put) => {
    const html = items
      .map((item, index) =>
        fill(item.template ?? fallback, (itemNodes, itemPut) => {
          for (const title of withRole(itemNodes, "title")) itemPut.put(title, escapeText(item.title ?? ""));
          for (const body of withRole(itemNodes, "body")) itemPut.put(body, renderRichText(item.body, item.bodyMeta));
          for (const node of withRole(itemNodes, "index")) node.attribs["data-accordion-index"] = String(index);
        }),
      )
      .join("\n");
    for (const container of withRole(nodes, "items")) put.put(container, html);
  });
}

function renderText(widget: TextWidget, template: string | undefined) {
  const body = renderRichText(widget.body, widget.bodyMeta);
  if (!template) return body;
  return fill(template, (nodes, put) => {
    for (const container of withRole(nodes, "body")) put.put(container, body);
  });
}

/** A widget's inner HTML. */
export function renderWidgetInner(widget: Widget): string {
  const template = widget.template ?? DEFAULT_TEMPLATES[widget._type] ?? "";
  switch (widget._type) {
    case "elHeading":
      return renderHeading(widget, template);
    case "elText":
      return renderText(widget, widget.template);
    case "elButton":
      return renderButton(widget, template);
    case "elImage":
      return renderImage(widget, template);
    case "elIconBox":
      return renderIconBox(widget, template);
    case "elIconList":
      return renderIconList(widget, template);
    case "elAccordion":
      return renderAccordion(widget, template);
    case "elRaw":
      return widget.html ?? "";
    default:
      return "";
  }
}

/** The widget <div>'s attributes: the original ones, or Elementor's for a widget added in the Studio. */
function widgetAttrs(widget: Widget, wrapper: string | null | undefined) {
  const attrs = parseAttrs(wrapper ?? widget.wrapper);
  if (Object.keys(attrs).length) return attrs;
  const name = widget._type === "elRaw" ? (widget.widgetType?.split(".")[0] ?? "html") : WIDGET_NAMES[widget._type];
  const id = elementId(widget._key ?? JSON.stringify(widget).slice(0, 200));
  return {
    class: `elementor-element elementor-element-${id} elementor-widget elementor-widget-${name}`,
    "data-id": id,
    "data-element_type": "widget",
    "data-e-type": "widget",
    "data-widget_type": `${name}.default`,
  };
}

export function renderWidget(widget: Widget, wrapper?: string | null): string {
  const tag = widget.tag && /^[a-z][a-z0-9-]*$/.test(widget.tag) && widget._type !== "elHeading" ? widget.tag : "div";
  return `<${tag}${attrString(widgetAttrs(widget, wrapper))}>${renderWidgetInner(widget)}</${tag}>`;
}

/** The layout of a section added in the Studio: a boxed Elementor section, one column per slot. */
function defaultLayout(section: Section): string {
  const id = elementId(section._key ?? "section");
  const slots = Math.max(1, section.slots?.length ?? 1);
  const width = { 1: 100, 2: 50, 3: 33, 4: 25, 5: 20, 6: 16 }[slots] ?? 100;
  const columns = Array.from({ length: slots }, (_, i) => {
    const columnId = elementId(`${section._key}:column${i}`);
    return `<div class="elementor-column elementor-col-${width} elementor-top-column elementor-element elementor-element-${columnId}" data-id="${columnId}" data-element_type="column" data-e-type="column"><div class="elementor-widget-wrap elementor-element-populated"><!--cms-slot:${i}--></div></div>`;
  }).join("");
  return `<section class="elementor-section elementor-top-section elementor-element elementor-element-${id} elementor-section-boxed elementor-section-height-default" data-id="${id}" data-element_type="section" data-e-type="section"><div class="elementor-container elementor-column-gap-default">${columns}</div></section>`;
}

function sameWidgetType(widget: Widget, wrapper: string | null | undefined) {
  if (!wrapper) return false;
  const original = parseAttrs(widget.wrapper)["data-widget_type"];
  return !original || parseAttrs(wrapper)["data-widget_type"] === original;
}

function renderSlot(slot: Slot | undefined, wrappers?: (string | null)[]): string {
  return (slot?.widgets ?? []).map((widget, i) => renderWidget(widget, sameWidgetType(widget, wrappers?.[i]) ? wrappers?.[i] : null)).join("\n");
}

export function renderSection(section: Section, skin?: { layout?: string; wrappers?: (string | null)[][] }): string {
  if (section.hidden) return "";
  const layout = skin?.layout ?? section.layout ?? defaultLayout(section);
  return layout.replace(/<!--cms-slot:(\d+)-->/g, (_match, index: string) => renderSlot(section.slots?.[Number(index)], skin?.wrappers?.[Number(index)]));
}

/** A shared section placed on a page: the shared content with the page's own Elementor ids. */
export function renderSharedRef(ref: SharedSectionRef, shared: SharedSection | null | undefined): string {
  if (ref.hidden || !shared) return "";
  const skin = parseJson<SectionSkin>(ref.skin, {});
  return (shared.sections ?? []).map((section, i) => renderSection(section, skin.sections?.[i])).join("\n");
}

/** A whole Elementor document (page, popup, block). `shared` resolves shared section references. */
export function renderDocument(document: ElementorDocument, shared: (ref: SharedSectionRef) => SharedSection | null | undefined = (ref) => ref.shared): string {
  const body = (document.sections ?? [])
    .map((section) => (section._type === "sharedSectionRef" ? renderSharedRef(section, shared(section)) : renderSection(section)))
    .filter(Boolean)
    .join("\n");
  const root = parseAttrs(document.rootAttrs);
  return Object.keys(root).length ? `<div${attrString(root)}>\n${body}\n</div>` : body;
}
