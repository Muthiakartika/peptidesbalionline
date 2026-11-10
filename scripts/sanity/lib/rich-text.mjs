// WordPress / Elementor HTML → Portable Text (Sanity's rich text), so editors get a real rich text
// editor (paragraph / Heading 1–6 / quote, bold, italic, links, colour, lists, images) instead of HTML.
//
// The website turns the blocks back into HTML (src/lib/content/render/rich-text.ts) and that HTML must
// be the same as the original, so nothing the live page shows is lost:
//   * what Portable Text has no place for is kept next to it: each block's own attributes (class,
//     data-*, style) in the hidden "bodyMeta" field, keyed by the block's _key; spans with attributes
//     as the "spanAttrs" annotation; whole elements Portable Text can't hold (tables, forms, iframes,
//     lists with paragraphs inside…) as an "htmlBlock" the editor can still edit as HTML;
//   * <hr> becomes a "dividerBlock" (a line in the editor, not HTML);
//   * <div>/<section> wrappers become "wrapperBlock"s holding their own rich text.
// The round-trip test (src/lib/content/render/round-trip.test.ts) checks every page.
import { attrsJson, collapse, isBlankText, isTag, isText, keyFor, serialize } from "./dom.mjs";

const DECORATORS = { strong: "strong", b: "strong", em: "em", i: "em", u: "underline", s: "strike-through", strike: "strike-through", del: "strike-through", code: "code", sup: "sup", sub: "sub" };
const BLOCK_STYLES = { p: "normal", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", blockquote: "blockquote" };
const WRAPPERS = new Set(["div", "section", "article", "header", "footer", "aside", "nav", "main", "figure", "center"]);
/** Inline elements kept as they are (tag + attributes) around rich text. */
const INLINE_WRAPPERS = new Set(["span", "small", "mark", "abbr", "cite", "q", "time", "kbd", "samp", "var", "dfn", "bdi", "bdo", "data", "label", "font", "big", "tt", "ins"]);
/** Inline elements whose inside isn't text (kept as HTML). */
const OPAQUE_INLINE = new Set(["svg", "iframe", "input", "button", "select", "textarea", "object", "video", "audio", "canvas", "math", "picture", "embed", "wbr"]);

class Unconvertible extends Error {}

const isInlineNode = (node) => isText(node) || (isTag(node) && (node.name === "br" || node.name === "img" || node.name === "a" || node.name in DECORATORS || INLINE_WRAPPERS.has(node.name) || OPAQUE_INLINE.has(node.name)));

/** "color: #fff;" → "#fff" when that is the span's only style; null otherwise. */
function onlyColor(attribs) {
  if (Object.keys(attribs).length !== 1 || !attribs.style) return null;
  const declarations = attribs.style.split(";").map((d) => d.trim()).filter(Boolean);
  if (declarations.length !== 1) return null;
  const match = declarations[0].match(/^color\s*:\s*(.+)$/i);
  return match ? match[1].trim() : null;
}

/** The image fields editors see (the original attributes stay in `attrs`). */
export function imageFromImg(attribs) {
  const url = attribs["data-src"] || attribs.src || "";
  const width = Number(attribs.width) || undefined;
  const height = Number(attribs.height) || undefined;
  return { _type: "r2Image", url: url.startsWith("data:") ? "" : url, alt: attribs.alt ?? "", ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

/**
 * Turns inline HTML into a block's children + markDefs. `marks` are the marks of the elements around
 * (outermost first), which is also the order the website nests them back in.
 */
function inlineChildren(nodes, state, marks = []) {
  for (const node of nodes) {
    if (isText(node)) {
      const text = collapse(node.data);
      if (text) pushSpan(state, text, marks);
    } else if (!isTag(node)) {
      // comments: dropped
    } else if (node.name !== "br" && node.name !== "img" && !OPAQUE_INLINE.has(node.name) && isEmptyInline(node)) {
      // An element with no text at all: a plain <b></b> shows nothing (dropped); one with
      // attributes may be drawn by CSS (e.g. the lab results page's copy icons), so it is kept as HTML.
      if (Object.keys(node.attribs).length || !(node.name in DECORATORS)) pushObject(state, marks, { _type: "inlineHtml", html: serialize([node]) });
    } else if (node.name === "br") {
      if (Object.keys(node.attribs).length) throw new Unconvertible("br with attributes");
      pushSpan(state, "\n", marks);
    } else if (node.name in DECORATORS && !Object.keys(node.attribs).length) {
      inlineChildren(node.children, state, [...marks, DECORATORS[node.name]]);
    } else if (node.name === "a" && node.attribs.href !== undefined) {
      const { href, target, rel, ...rest } = node.attribs;
      const onlyChild = node.children.filter((c) => !isBlankText(c));
      if (onlyChild.length === 1 && isTag(onlyChild[0]) && onlyChild[0].name === "img" && node.children.length === 1) {
        // A linked picture: the link is kept on the picture itself (Portable Text pictures can't sit inside a link).
        pushObject(state, marks, { _type: "inlineImage", image: imageFromImg(onlyChild[0].attribs), attrs: attrsJson(onlyChild[0].attribs), link: { href, ...(target ? { target } : {}), ...(rel ? { rel } : {}), attrs: attrsJson(rest) } });
        continue;
      }
      const key = keyFor(`${state.seed}:m${state.markDefs.length}`);
      state.markDefs.push({ _type: "link", _key: key, href, ...(target ? { target } : {}), ...(rel ? { rel } : {}), ...(Object.keys(rest).length ? { attrs: attrsJson(rest) } : {}) });
      inlineChildren(node.children, state, [...marks, key]);
    } else if (node.name === "span" && onlyColor(node.attribs)) {
      const key = keyFor(`${state.seed}:m${state.markDefs.length}`);
      state.markDefs.push({ _type: "textColor", _key: key, color: onlyColor(node.attribs) });
      inlineChildren(node.children, state, [...marks, key]);
    } else if (INLINE_WRAPPERS.has(node.name) || node.name in DECORATORS || node.name === "a") {
      const key = keyFor(`${state.seed}:m${state.markDefs.length}`);
      state.markDefs.push({ _type: "spanAttrs", _key: key, tag: node.name, attrs: attrsJson(node.attribs) });
      inlineChildren(node.children, state, [...marks, key]);
    } else if (node.name === "img") {
      pushObject(state, marks, { _type: "inlineImage", image: imageFromImg(node.attribs), attrs: attrsJson(node.attribs) });
    } else if (OPAQUE_INLINE.has(node.name)) {
      pushObject(state, marks, { _type: "inlineHtml", html: serialize([node]) });
    } else {
      throw new Unconvertible(`<${node.name}> inside text`);
    }
  }
}

/** No characters, no line breaks, no pictures inside. */
function isEmptyInline(node) {
  if (isText(node)) return node.data === "";
  if (!isTag(node)) return true;
  if (node.name === "br" || node.name === "img" || OPAQUE_INLINE.has(node.name)) return false;
  return node.children.every(isEmptyInline);
}

function pushSpan(state, text, marks) {
  const last = state.children.at(-1);
  if (last?._type === "span" && last.marks.join(" ") === marks.join(" ")) {
    last.text += text;
    return;
  }
  state.children.push({ _type: "span", _key: keyFor(`${state.seed}:c${state.children.length}`), text, marks: [...marks] });
}

function pushObject(state, marks, object) {
  // Portable Text keeps marks on text only; a picture or HTML piece inside bold/link text can't be
  // stored, so that block stays HTML.
  if (marks.length) throw new Unconvertible("object inside marks");
  state.children.push({ _key: keyFor(`${state.seed}:c${state.children.length}`), ...object });
}

/** Trim the spaces at the start and end of a block (the browser doesn't show them either). */
function trimEnds(children) {
  const first = children.find((c) => c._type === "span");
  if (first && children[0] === first) first.text = first.text.replace(/^ +/, "");
  const last = children.at(-1);
  if (last?._type === "span") last.text = last.text.replace(/ +$/, "");
  const kept = children.filter((c) => c._type !== "span" || c.text !== "");
  return kept;
}

function makeBlock(seed, nodes, extra) {
  const state = { seed, children: [], markDefs: [] };
  inlineChildren(nodes, state);
  let children = trimEnds(state.children);
  if (!children.length) children = [{ _type: "span", _key: keyFor(`${seed}:c0`), text: "", marks: [] }];
  return { _type: "block", _key: keyFor(seed), style: "normal", ...extra, markDefs: state.markDefs, children };
}

/**
 * HTML → { blocks, meta }. `boxes`: how many <div>s inside each other may still become boxes. `meta` maps a block's _key to what the block's HTML had besides its text:
 * { attrs } (the element's attributes), { bare: true } (text with no <p> around it),
 * { list: { attrs? } } (this item starts a new <ul>/<ol>).
 */
export function htmlToRichText(nodes, seed, { boxes = 3 } = {}) {
  const blocks = [];
  const meta = {};
  const setMeta = (key, value) => {
    if (Object.keys(value).length) meta[key] = { ...meta[key], ...value };
  };
  let run = [];

  const flushRun = () => {
    const nodesInRun = run;
    run = [];
    if (nodesInRun.every((n) => isBlankText(n) || (!isTag(n) && !isText(n)))) return;
    const seedHere = `${seed}:${blocks.length}`;
    const solo = nodesInRun.filter((n) => !isBlankText(n));
    if (solo.length === 1 && isTag(solo[0]) && solo[0].name === "img") {
      blocks.push({ _type: "imageBlock", _key: keyFor(seedHere), image: imageFromImg(solo[0].attribs), attrs: attrsJson(solo[0].attribs) });
      setMeta(keyFor(seedHere), { bare: true });
      return;
    }
    try {
      const block = makeBlock(seedHere, nodesInRun);
      blocks.push(block);
      setMeta(block._key, { bare: true });
    } catch (error) {
      if (!(error instanceof Unconvertible)) throw error;
      blocks.push({ _type: "htmlBlock", _key: keyFor(seedHere), html: serialize(nodesInRun) });
    }
  };

  const asHtml = (node) => blocks.push({ _type: "htmlBlock", _key: keyFor(`${seed}:${blocks.length}`), html: serialize([node]) });

  for (const node of nodes) {
    if (isInlineNode(node)) {
      run.push(node);
      continue;
    }
    if (!isTag(node)) continue; // comments, doctype
    flushRun();
    const seedHere = `${seed}:${blocks.length}`;
    if (node.name in BLOCK_STYLES) {
      try {
        const block = makeBlock(seedHere, node.children, { style: BLOCK_STYLES[node.name] });
        blocks.push(block);
        if (Object.keys(node.attribs).length) setMeta(block._key, { attrs: node.attribs });
      } catch (error) {
        if (!(error instanceof Unconvertible)) throw error;
        asHtml(node);
      }
    } else if (node.name === "ul" || node.name === "ol") {
      const before = blocks.length;
      try {
        listBlocks(node, 1, seedHere, blocks, setMeta);
      } catch (error) {
        if (!(error instanceof Unconvertible)) throw error;
        blocks.length = before;
        asHtml(node);
      }
    } else if (node.name === "hr" && !node.children.length) {
      blocks.push(dividerBlock(node.attribs, seedHere));
    } else if (WRAPPERS.has(node.name) && boxes > 0) {
      // Sanity stores at most 20 levels per document, so boxes inside boxes stop after a few levels
      // (`boxes`); deeper ones stay HTML.
      const inner = htmlToRichText(node.children, seedHere, { boxes: boxes - 1 });
      blocks.push({ _type: "wrapperBlock", _key: keyFor(seedHere), tag: node.name, attrs: attrsJson(node.attribs), body: inner.blocks, bodyMeta: JSON.stringify(inner.meta) });
    } else {
      asHtml(node);
    }
  }
  flushRun();
  return { blocks, meta };
}

/**
 * Position marks ChatGPT puts on what it writes; they come along when its text is pasted into
 * WordPress. Nothing reads them, so a divider line doesn't keep them (the round-trip test ignores
 * them on <hr>: src/lib/content/render/compare.ts).
 */
export const PASTE_MARKS = ["data-start", "data-end"];

/** <hr> → a "Divider line" block, keeping its other attributes (e.g. a class) hidden. */
export function dividerBlock(attribs, seed) {
  const kept = Object.fromEntries(Object.entries(attribs ?? {}).filter(([name]) => !PASTE_MARKS.includes(name)));
  const attrs = attrsJson(kept);
  return { _type: "dividerBlock", _key: keyFor(seed), ...(attrs ? { attrs } : {}) };
}

function listBlocks(list, level, seed, blocks, setMeta) {
  const listItem = list.name === "ol" ? "number" : "bullet";
  let first = true;
  for (const item of list.children) {
    if (isBlankText(item) || (!isTag(item) && !isText(item))) continue;
    if (!isTag(item) || item.name !== "li") throw new Unconvertible("list without <li>");
    // An item is its text, then (optionally) the lists nested in it, nothing after them.
    const kids = item.children;
    let split = kids.length;
    while (split > 0 && (isBlankText(kids[split - 1]) || (isTag(kids[split - 1]) && (kids[split - 1].name === "ul" || kids[split - 1].name === "ol")))) split--;
    const text = kids.slice(0, split);
    const nested = kids.slice(split).filter(isTag);
    if (text.some((n) => isTag(n) && !isInlineNode(n))) throw new Unconvertible("block inside <li>");
    const block = makeBlock(`${seed}:${blocks.length}`, text, { listItem, level });
    blocks.push(block);
    if (Object.keys(item.attribs).length) setMeta(block._key, { attrs: item.attribs });
    if (first) setMeta(block._key, { list: Object.keys(list.attribs).length ? { attrs: list.attribs } : {} });
    first = false;
    for (const sub of nested) listBlocks(sub, level + 1, seed, blocks, setMeta);
  }
  if (first) throw new Unconvertible("empty list");
}

/**
 * Inline HTML (a heading's title, an icon box's description) → one block, or null when it holds
 * anything but text and inline formatting.
 */
export function htmlToInlineText(nodes, seed) {
  try {
    return [makeBlock(seed, nodes)];
  } catch (error) {
    if (error instanceof Unconvertible) return null;
    throw error;
  }
}

/** Plain text of rich text blocks (for labels and previews). */
export function plainText(blocks) {
  return (blocks ?? [])
    .map((block) => (block._type === "block" ? block.children.map((c) => c.text ?? "").join("") : block._type === "wrapperBlock" ? plainText(block.body) : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
