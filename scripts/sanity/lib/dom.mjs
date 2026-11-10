// Small DOM helpers for the HTML → Sanity converter (scripts/sanity/). The same parser
// (htmlparser2) and serializer (dom-serializer) that html-react-parser uses on the website, so what
// the converter reads is what the site renders.
import crypto from "node:crypto";

import renderDom from "dom-serializer";
import * as domutils from "domutils";
import { parseDocument } from "htmlparser2";

export { domutils };

/** Parse HTML into a list of nodes (entities decoded, like the browser). */
export function parse(html) {
  return parseDocument(html ?? "", { decodeEntities: true }).children;
}

/** Serialize nodes back to HTML (UTF-8 text, only &, <, > and quotes escaped). */
export function serialize(nodes) {
  return renderDom(nodes, { encodeEntities: "utf8", decodeEntities: true });
}

export const isTag = (node) => node?.type === "tag" || node?.type === "script" || node?.type === "style";
export const isText = (node) => node?.type === "text";
// Only HTML whitespace: a non-breaking space is visible text.
export const isBlankText = (node) => isText(node) && /^[ \t\n\r\f]*$/.test(node.data);
export const hasClass = (node, name) => isTag(node) && (node.attribs.class ?? "").split(/\s+/).includes(name);
export const elementChildren = (node) => (node.children ?? []).filter(isTag);

/** The first element below `nodes` (depth first) that matches. */
export function find(nodes, test) {
  return domutils.findOne((node) => test(node), Array.isArray(nodes) ? nodes : [nodes], true);
}

export function findAll(nodes, test) {
  return domutils.findAll((node) => test(node), Array.isArray(nodes) ? nodes : [nodes]);
}

/** Collapse whitespace like the browser does in normal text (runs of spaces/newlines → one space). */
export const collapse = (text) => text.replace(/[ \t\n\r\f]+/g, " ");

/** The visible text of nodes, whitespace collapsed and trimmed. */
export const textOf = (nodes) => collapse(domutils.textContent(Array.isArray(nodes) ? nodes : [nodes])).trim();

/** A stable 12-character key from a seed (Sanity array items need a `_key`; stable keys keep
 * re-imports from looking like brand-new items). */
export const keyFor = (seed) => crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 12);

/** Attributes as a JSON string (what the hidden "attrs" fields store); "" for none. */
export function attrsJson(attribs) {
  const entries = Object.entries(attribs ?? {});
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : "";
}

/** Remove an element, keeping nothing. */
export function remove(node) {
  domutils.removeElement(node);
}

/** Empty an element. */
export function empty(node) {
  for (const child of [...(node.children ?? [])]) domutils.removeElement(child);
}

/** A deep copy of nodes (templates are cut out of copies, never out of the original). */
export function clone(nodes) {
  return parse(serialize(nodes));
}
