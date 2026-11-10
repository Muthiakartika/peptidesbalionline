// Elementor HTML (as the live site printed it) → Sanity objects editors can change, section by
// section and widget by widget.
//
//   document  = the Elementor root <div class="elementor elementor-<id>"> (its attributes: rootAttrs)
//               + sections (top-level <section>s / containers)
//   section   = elSection: its HTML skeleton ("layout": rows, columns, backgrounds, Elementor's ids and
//               classes, which the page's own Elementor CSS needs) with <!--cms-slot:N--> where its
//               widgets were + slots (one per column) holding the widgets
//   widget    = the widget's own fields (heading text + tag, rich text, button label + link, picture,
//               icon box, icon list, accordion items…) + the hidden "wrapper" (the widget <div>'s
//               attributes) and "template" (its inner HTML, the editable parts marked data-cms="…")
//
// Widgets the converter doesn't know become elRaw (their HTML, editable as HTML). The website puts
// everything back together in src/lib/content/render/elementor.ts; the round-trip test checks that
// every page comes out the same.
import { attrsJson, clone, collapse, elementChildren, empty, find, findAll, hasClass, isBlankText, isTag, keyFor, parse, serialize } from "./dom.mjs";
import { htmlToInlineText, htmlToRichText, imageFromImg, plainText } from "./rich-text.mjs";

const isWidget = (node) => isTag(node) && node.attribs["data-element_type"] === "widget";
const elementType = (node) => (isTag(node) ? node.attribs["data-element_type"] : undefined);

function mark(node, role) {
  const roles = (node.attribs["data-cms"] ?? "").split(" ").filter(Boolean);
  if (!roles.includes(role)) roles.push(role);
  node.attribs["data-cms"] = roles.join(" ");
}

/** The widget's inner nodes, copied (templates are cut from the copy). */
const innerCopy = (widget) => clone(widget.children);

/** Plain text of an element whose children are only text; null if it holds other elements. */
function plainChildText(node) {
  if (node.children.some(isTag)) return null;
  return collapse(node.children.map((c) => c.data ?? "").join("")).trim();
}

// ---------------------------------------------------------------- widgets

const widgetConverters = {
  "heading.default"(inner, seed) {
    const title = find(inner, (n) => hasClass(n, "elementor-heading-title"));
    if (!title) return null;
    const text = htmlToInlineText(title.children, `${seed}:title`);
    if (!text) return null;
    mark(title, "title");
    empty(title);
    return { _type: "elHeading", title: text, tag: title.name };
  },

  "text-editor.default"(inner, seed) {
    const tags = inner.filter(isTag);
    const container = tags.length === 1 && hasClass(tags[0], "elementor-widget-container") && inner.every((n) => n === tags[0] || isBlankText(n)) ? tags[0] : null;
    const { blocks, meta } = htmlToRichText(container ? container.children : inner, `${seed}:body`);
    if (container) {
      mark(container, "body");
      empty(container);
    }
    return { _type: "elText", body: blocks, bodyMeta: JSON.stringify(meta), ...(container ? {} : { template: "" }) };
  },

  "button.default"(inner) {
    const link = find(inner, (n) => hasClass(n, "elementor-button"));
    const label = link && find(link, (n) => hasClass(n, "elementor-button-text"));
    if (!link || link.name !== "a" || !label) return null;
    const text = plainChildText(label);
    const { target, rel, href } = link.attribs;
    if (text === null || (target && target !== "_blank")) return null;
    mark(link, "link");
    mark(label, "label");
    empty(label);
    return { _type: "elButton", label: text, href: href ?? "", newTab: target === "_blank", ...(rel ? { rel } : {}) };
  },

  "image.default"(inner) {
    const images = findAll(inner, (n) => n.name === "img");
    if (!images.length) return null;
    const image = imageFromImg(images[0].attribs);
    for (const img of images) if (imageFromImg(img.attribs).url === image.url) mark(img, "img");
    const link = find(inner, (n) => n.name === "a" && find(n, (m) => m === images[0]));
    if (link) mark(link, "link");
    const { href, target } = link?.attribs ?? {};
    if (target && target !== "_blank") return null;
    return { _type: "elImage", image, ...(link ? { href: href ?? "", newTab: target === "_blank" } : {}) };
  },

  "icon-box.default"(inner, seed) {
    const title = find(inner, (n) => hasClass(n, "elementor-icon-box-title"));
    const content = find(inner, (n) => hasClass(n, "elementor-icon-box-content"));
    const description = find(inner, (n) => hasClass(n, "elementor-icon-box-description"));
    if (!content) return null;
    let titleText = "";
    if (title) {
      const kids = elementChildren(title);
      const holder = kids.length === 1 && title.children.every((c) => c === kids[0] || isBlankText(c)) ? kids[0] : title;
      titleText = plainChildText(holder);
      if (titleText === null) return null;
      mark(title, "title");
      mark(holder, "titleText");
      empty(holder);
    }
    let desc = null;
    if (description) {
      desc = htmlToInlineText(description.children, `${seed}:desc`);
      if (!desc) return null;
      mark(description, "desc");
      empty(description);
    }
    const links = findAll(inner, (n) => n.name === "a");
    const hrefs = new Set(links.map((a) => a.attribs.href ?? ""));
    if (hrefs.size > 1 || links.some((a) => a.attribs.target && a.attribs.target !== "_blank")) return null;
    for (const a of links) mark(a, "link");
    mark(content, "content");
    return {
      _type: "elIconBox",
      title: titleText,
      titleTag: title?.name ?? "h3",
      ...(desc ? { description: desc } : {}),
      ...(links.length ? { href: [...hrefs][0], newTab: links[0].attribs.target === "_blank" } : {}),
    };
  },

  "icon-list.default"(inner, seed) {
    const list = find(inner, (n) => hasClass(n, "elementor-icon-list-items"));
    if (!list) return null;
    const items = [];
    for (const li of elementChildren(list)) {
      const textHolder = find(li, (n) => hasClass(n, "elementor-icon-list-text"));
      if (!textHolder) return null;
      const text = plainChildText(textHolder);
      const links = findAll(li, (n) => n.name === "a");
      if (text === null || links.length > 1 || (links[0]?.attribs.target && links[0].attribs.target !== "_blank")) return null;
      mark(textHolder, "text");
      empty(textHolder);
      if (links[0]) mark(links[0], "link");
      items.push({
        _type: "elIconListItem",
        _key: keyFor(`${seed}:item${items.length}`),
        text,
        ...(links[0] ? { href: links[0].attribs.href ?? "", newTab: links[0].attribs.target === "_blank" } : {}),
        template: serialize([li]),
      });
    }
    if (list.children.some((c) => !isTag(c) && !isBlankText(c))) return null;
    mark(list, "items");
    empty(list);
    return { _type: "elIconList", items };
  },

  "wd_accordion.default"(inner, seed) {
    const container = find(inner, (n) => hasClass(n, "wd-accordion"));
    if (!container) return null;
    const items = [];
    for (const item of elementChildren(container)) {
      if (!hasClass(item, "wd-accordion-item")) return null;
      const titleText = find(item, (n) => hasClass(n, "wd-accordion-title-text"));
      const body = find(item, (n) => hasClass(n, "wd-accordion-content"));
      if (!titleText || !body) return null;
      const kids = elementChildren(titleText);
      const holder = kids.length === 1 ? kids[0] : titleText;
      const title = plainChildText(holder);
      if (title === null) return null;
      const { blocks, meta } = htmlToRichText(body.children, `${seed}:item${items.length}`, { boxes: 2 });
      mark(holder, "title");
      empty(holder);
      mark(body, "body");
      empty(body);
      for (const indexed of findAll(item, (n) => n.attribs["data-accordion-index"] !== undefined)) mark(indexed, "index");
      items.push({ _type: "elAccordionItem", _key: keyFor(`${seed}:item${items.length}`), title, body: blocks, bodyMeta: JSON.stringify(meta), template: serialize([item]) });
    }
    if (container.children.some((c) => !isTag(c) && !isBlankText(c))) return null;
    mark(container, "items");
    empty(container);
    return { _type: "elAccordion", items };
  },
};

export function convertWidget(widget, seed) {
  const type = widget.attribs["data-widget_type"] ?? "";
  const wrapper = attrsJson(widget.attribs);
  const base = { _key: keyFor(seed), wrapper, ...(widget.name !== "div" ? { tag: widget.name } : {}) };
  const convert = widgetConverters[type];
  if (convert) {
    const inner = innerCopy(widget);
    const fields = convert(inner, seed);
    if (fields) return { ...base, ...fields, ...("template" in fields ? {} : { template: serialize(inner) }) };
  }
  return { ...base, _type: "elRaw", widgetType: type, html: serialize(widget.children) };
}

// ---------------------------------------------------------------- sections

/** "Column 2/3", "Column 1/2 › Column 2/2" (inner section), "Box 1/2"… for the editor. */
function slotName(parent, section) {
  const parts = [];
  for (let node = parent; node && node !== section; node = node.parent) {
    const type = elementType(node);
    if (type !== "column" && type !== "container") continue;
    const siblings = (node.parent?.children ?? []).filter((c) => elementType(c) === type);
    parts.unshift(`${type === "column" ? "Column" : "Box"} ${siblings.indexOf(node) + 1}/${siblings.length}`);
  }
  return parts.join(" › ") || "Content";
}

/** The first heading-like text in a section (its label in the editor). */
export function sectionLabel(slots) {
  for (const slot of slots) {
    for (const widget of slot.widgets) {
      if (widget._type === "elHeading") return plainText(widget.title);
      if (widget._type === "elIconBox" && widget.title) return widget.title;
    }
  }
  for (const slot of slots) {
    for (const widget of slot.widgets) {
      if (widget._type === "elText") return plainText(widget.body).slice(0, 80);
      if (widget._type === "elButton") return widget.label;
    }
  }
  return "Section";
}

export function convertSection(node, seed) {
  const [copy] = clone([node]);
  const slots = [];
  const walk = (element) => {
    if (!isTag(element) || isWidget(element)) return;
    const kids = [...element.children];
    const runs = [];
    let current = null;
    for (const kid of kids) {
      if (isWidget(kid)) {
        if (!current) runs.push((current = []));
        current.push(kid);
      } else if (isBlankText(kid) && current) {
        current.push(kid);
      } else {
        current = null;
        walk(kid);
      }
    }
    for (const run of runs) {
      const widgets = run.filter(isWidget);
      const index = slots.length;
      slots.push({
        _type: "elSlot",
        _key: keyFor(`${seed}:slot${index}`),
        name: slotName(element, copy),
        widgets: widgets.map((w, i) => convertWidget(w, `${seed}:s${index}w${i}`)),
      });
      // Swap the run (widgets and the blank text between them) for the slot's marker.
      const marker = parse(`<!--cms-slot:${index}-->`)[0];
      const at = element.children.indexOf(run[0]);
      const trailing = run.at(-1);
      let end = element.children.indexOf(trailing);
      while (end > at && isBlankText(element.children[end])) end--;
      element.children.splice(at, end - at + 1, marker);
      marker.parent = element;
    }
    // An empty column still gets a slot, so editors can add widgets to it.
    if (!runs.length && hasClass(element, "elementor-widget-wrap") && !element.children.some(isTag)) {
      const index = slots.length;
      slots.push({ _type: "elSlot", _key: keyFor(`${seed}:slot${index}`), name: slotName(element, copy), widgets: [] });
      empty(element);
      const marker = parse(`<!--cms-slot:${index}-->`)[0];
      element.children.push(marker);
      marker.parent = element;
    }
  };
  walk(copy);
  // Fix the sibling links domutils relies on after the splices.
  relink(copy);
  return { _type: "elSection", _key: keyFor(seed), label: sectionLabel(slots), layout: serialize([copy]), slots };
}

function relink(node) {
  const kids = node.children ?? [];
  kids.forEach((kid, i) => {
    kid.parent = node;
    kid.prev = kids[i - 1] ?? null;
    kid.next = kids[i + 1] ?? null;
    relink(kid);
  });
}

/** An Elementor document (page, popup, block) → { rootAttrs, sections }. */
export function convertDocument(html, seed) {
  const nodes = parse(html).filter((n) => !isBlankText(n));
  const root = nodes[0];
  if (nodes.length !== 1 || !isTag(root) || !hasClass(root, "elementor")) throw new Error(`${seed}: not a single Elementor document`);
  const sections = root.children.filter((n) => !isBlankText(n)).map((n, i) => (isTag(n) ? convertSection(n, `${seed}:sec${i}`) : null));
  if (sections.includes(null)) throw new Error(`${seed}: text or comments between sections`);
  return { rootAttrs: attrsJson(root.attribs), sections };
}

/** Same HTML apart from Elementor's element ids (copies of one section on several pages). */
export function sectionSignature(node) {
  return serialize([node])
    .replace(/elementor-element-[0-9a-f]{6,8}\b/g, "elementor-element-#")
    .replace(/data-id="[0-9a-f]{6,8}"/g, 'data-id="#"');
}
