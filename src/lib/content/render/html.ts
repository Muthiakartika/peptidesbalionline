/**
 * HTML helpers for the content renderer: the same parser (htmlparser2) and serializer (dom-serializer)
 * html-react-parser uses, so what is built here is read back the same way by ElementorContent.
 */
import renderDom from "dom-serializer";
import { Element, Text, type ChildNode } from "domhandler";
import * as domutils from "domutils";
import { parseDocument } from "htmlparser2";

export { domutils, Element, Text };
export type { ChildNode };

export function parse(html: string): ChildNode[] {
  return parseDocument(html, { decodeEntities: true }).children;
}

export function serialize(nodes: ChildNode | ChildNode[]): string {
  return renderDom(nodes, { encodeEntities: "utf8", decodeEntities: true });
}

export const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** ` name="value"` for each attribute (an empty value prints the bare name, as WordPress does). */
const ATTR_NAME = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;

export function attrString(attrs: Record<string, string | undefined> | null | undefined): string {
  let out = "";
  for (const [name, value] of Object.entries(attrs ?? {})) {
    // Names come from hidden fields stored in Sanity: anything that isn't a plain attribute name is skipped.
    if (value === undefined || !ATTR_NAME.test(name)) continue;
    out += value === "" ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
  }
  return out;
}

/** A hidden "attrs"/"wrapper" field (JSON) → attributes; {} when empty or broken. */
export function parseAttrs(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export const isElement = (node: ChildNode | null | undefined): node is Element => node instanceof Element;

/** Elements of a template that carry the role in data-cms="…". */
export function withRole(nodes: ChildNode[], role: string): Element[] {
  return domutils.findAll((node) => (node.attribs["data-cms"] ?? "").split(" ").includes(role), nodes);
}

/** Replace an element's children with a placeholder text that `fill` swaps for HTML afterwards. */
export class Placeholders {
  private values: string[] = [];
  put(node: Element, html: string) {
    const token = `@@cms-${this.values.length}@@`;
    this.values.push(html);
    for (const child of [...node.children]) domutils.removeElement(child);
    domutils.appendChild(node, new Text(token));
  }
  fill(html: string): string {
    return html.replace(/@@cms-(\d+)@@/g, (_match, index: string) => this.values[Number(index)] ?? "");
  }
}

/** Remove the data-cms marks before the template is printed. */
export function clearRoles(nodes: ChildNode[]) {
  for (const node of domutils.findAll((n) => "data-cms" in n.attribs, nodes)) delete node.attribs["data-cms"];
}

/** Replace an element with its children (e.g. a link that no longer has an address). */
export function unwrap(node: Element) {
  const parent = node.parent;
  if (!parent) return;
  const index = parent.children.indexOf(node);
  const kids = [...node.children];
  parent.children.splice(index, 1, ...kids);
  for (const kid of kids) kid.parent = parent;
  relink(parent);
}

/** Put an element inside a new one (a picture inside a link). */
export function wrapElement(node: Element, name: string, attribs: Record<string, string>) {
  const parent = node.parent;
  if (!parent) return;
  const wrapper = new Element(name, attribs, [node]);
  parent.children.splice(parent.children.indexOf(node), 1, wrapper);
  wrapper.parent = parent;
  node.parent = wrapper;
  relink(parent);
}

/** Remove an element. */
export function removeNode(node: ChildNode) {
  const parent = node.parent;
  if (!parent) return;
  parent.children.splice(parent.children.indexOf(node), 1);
  relink(parent);
}

/** Wrap an element's children in a new element. */
export function wrapChildren(node: Element, name: string, attribs: Record<string, string>) {
  const wrapper = new Element(name, attribs, [...node.children]);
  for (const kid of wrapper.children) kid.parent = wrapper;
  node.children = [wrapper];
  wrapper.parent = node;
  relink(wrapper);
  relink(node);
}

export function relink(node: Element | { children: ChildNode[] }) {
  node.children.forEach((kid, i) => {
    kid.prev = node.children[i - 1] ?? null;
    kid.next = node.children[i + 1] ?? null;
  });
}

/** Rename an element (a heading's h2 → h3). */
export function rename(node: Element, name: string) {
  node.name = name;
}
