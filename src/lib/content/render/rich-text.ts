/**
 * Portable Text (Sanity rich text) → HTML, the way the converter (scripts/sanity/lib/rich-text.mjs)
 * read it: block attributes come back from the hidden "bodyMeta", marks are nested in the order they
 * are stored (outermost first), "\n" is a line break, and pictures keep their original attributes
 * unless the editor picked another picture.
 */
import type { BlockMeta, ImageBlock, InlineImage, MarkDef, R2Image, RichText, Span, TextBlock } from "../types";
import { attrString, escapeAttr, escapeText, parseAttrs, parseJson } from "./html";

const DECORATOR_TAGS: Record<string, string> = {
  strong: "strong",
  em: "em",
  underline: "u",
  "strike-through": "s",
  code: "code",
  sup: "sup",
  sub: "sub",
};
const STYLE_TAGS: Record<string, string> = { normal: "p", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", blockquote: "blockquote" };
const SAFE_TAG = /^[a-z][a-z0-9-]*$/;

function openMark(mark: string, defs: Map<string, MarkDef>): [open: string, close: string] {
  const decorator = DECORATOR_TAGS[mark];
  if (decorator) return [`<${decorator}>`, `</${decorator}>`];
  const def = defs.get(mark);
  if (!def) return ["", ""];
  if (def._type === "link") {
    const attrs = { ...parseAttrs(def.attrs), href: def.href ?? "", ...(def.target ? { target: def.target } : {}), ...(def.rel ? { rel: def.rel } : {}) };
    return [`<a${attrString(attrs)}>`, "</a>"];
  }
  if (def._type === "textColor") return def.color ? [`<span style="color: ${escapeAttr(def.color)};">`, "</span>"] : ["", ""];
  if (def._type === "spanAttrs") {
    const tag = def.tag && SAFE_TAG.test(def.tag) ? def.tag : "span";
    return [`<${tag}${attrString(parseAttrs(def.attrs))}>`, `</${tag}>`];
  }
  return ["", ""];
}

/** A picture's attributes: the original ones, unless the editor chose another file. */
export function imageAttrs(original: Record<string, string>, image: R2Image | undefined): Record<string, string> | null {
  const attrs = { ...original };
  const originalUrl = attrs["data-src"] || (attrs.src?.startsWith("data:") ? "" : attrs.src) || "";
  const url = image?.url ?? originalUrl;
  if (!url) return null;
  if (url !== originalUrl) {
    for (const name of ["data-src", "data-srcset", "data-sizes", "data-lazyloaded", "srcset", "sizes", "width", "height"]) delete attrs[name];
    attrs.src = url;
    if (image?.width) attrs.width = String(image.width);
    if (image?.height) attrs.height = String(image.height);
    if (attrs.class) attrs.class = attrs.class.replace(/\bwp-image-\d+\b/, "").replace(/\s+/g, " ").trim();
    if (!attrs.class) delete attrs.class;
    attrs.decoding ??= "async";
    attrs.loading ??= "lazy";
  }
  attrs.alt = image?.alt ?? attrs.alt ?? "";
  return attrs;
}

function renderInlineImage(object: InlineImage): string {
  const attrs = imageAttrs(parseAttrs(object.attrs), object.image);
  if (!attrs) return "";
  const img = `<img${attrString(attrs)}>`;
  if (!object.link?.href) return img;
  const link = { ...parseAttrs(object.link.attrs), href: object.link.href, ...(object.link.target ? { target: object.link.target } : {}), ...(object.link.rel ? { rel: object.link.rel } : {}) };
  return `<a${attrString(link)}>${img}</a>`;
}

/** A block's children (text and inline objects) with their marks. */
export function renderChildren(block: Pick<TextBlock, "children" | "markDefs">): string {
  const defs = new Map((block.markDefs ?? []).map((def) => [def._key, def]));
  let out = "";
  const stack: { mark: string; close: string }[] = [];
  for (const child of block.children ?? []) {
    const marks = child._type === "span" ? ((child as Span).marks ?? []) : [];
    let common = 0;
    while (common < stack.length && common < marks.length && stack[common].mark === marks[common]) common++;
    while (stack.length > common) out += stack.pop()!.close;
    for (const mark of marks.slice(common)) {
      const [open, close] = openMark(mark, defs);
      out += open;
      stack.push({ mark, close });
    }
    if (child._type === "span") out += escapeText((child as Span).text ?? "").replace(/\n/g, "<br>");
    else if (child._type === "inlineImage") out += renderInlineImage(child as InlineImage);
    else if (child._type === "inlineHtml") out += (child as { html?: string }).html ?? "";
  }
  while (stack.length) out += stack.pop()!.close;
  return out;
}

/** One-line rich text (a heading's title): the text of its blocks, joined by line breaks. */
export function renderInline(blocks: RichText | undefined): string {
  return (blocks ?? [])
    .filter((block): block is TextBlock => block._type === "block")
    .map((block) => renderChildren(block))
    .join("<br>");
}

function renderImageBlock(block: ImageBlock, meta: BlockMeta | undefined): string {
  const original = parseAttrs(block.attrs);
  const attrs = imageAttrs(original, block.image);
  if (!attrs) return "";
  const img = `<img${attrString(attrs)}>`;
  return meta?.bare || block.attrs ? img : `<p>${img}</p>`;
}

/** Rich text → HTML. `metaJson` is the hidden "bodyMeta" next to it. */
export function renderRichText(blocks: RichText | undefined, metaJson?: string): string {
  const meta = parseJson<Record<string, BlockMeta>>(metaJson, {});
  const parts: string[] = [];
  const lists: { level: number; tag: string }[] = [];
  const closeLists = (downTo: number) => {
    while (lists.length && lists.at(-1)!.level > downTo) parts.push(`</li></${lists.pop()!.tag}>`);
  };

  for (const block of blocks ?? []) {
    const blockMeta = block._key ? meta[block._key] : undefined;
    if (block._type === "block" && block.listItem) {
      const level = Math.max(1, block.level ?? 1);
      const tag = block.listItem === "number" ? "ol" : "ul";
      closeLists(level);
      const top = lists.at(-1);
      if (top && top.level === level) {
        if (top.tag !== tag || blockMeta?.list) {
          parts.push(`</li></${top.tag}>`);
          lists.pop();
        } else {
          parts.push("</li>");
        }
      }
      if (!lists.length || lists.at(-1)!.level < level) {
        parts.push(`<${tag}${attrString(blockMeta?.list?.attrs)}>`);
        lists.push({ level, tag });
      }
      parts.push(`<li${attrString(blockMeta?.attrs)}>${renderChildren(block)}`);
      continue;
    }
    closeLists(0);
    if (block._type === "block") {
      const inner = renderChildren(block);
      if (blockMeta?.bare) parts.push(inner);
      else {
        const tag = STYLE_TAGS[block.style ?? "normal"] ?? "p";
        parts.push(`<${tag}${attrString(blockMeta?.attrs)}>${inner}</${tag}>`);
      }
    } else if (block._type === "htmlBlock") {
      parts.push(block.html ?? "");
    } else if (block._type === "imageBlock") {
      parts.push(renderImageBlock(block, blockMeta));
    } else if (block._type === "wrapperBlock") {
      const tag = block.tag && SAFE_TAG.test(block.tag) ? block.tag : "div";
      parts.push(`<${tag}${attrString(parseAttrs(block.attrs))}>${renderRichText(block.body, block.bodyMeta)}</${tag}>`);
    }
  }
  closeLists(0);
  return parts.join("\n");
}
