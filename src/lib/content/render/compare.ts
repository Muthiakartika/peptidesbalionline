/**
 * For the round-trip test: HTML → a canonical text, so two pieces of HTML that the browser shows the
 * same way compare equal. What it ignores (and only this):
 *   * comments, attribute order, extra spaces inside class and style attributes;
 *   * whitespace the browser doesn't show: runs of spaces/newlines count as one space, and spaces next
 *     to block elements (paragraphs, list items, divs…) or at the edges of the button / icon list
 *     texts don't count;
 *   * <b> = <strong>, <i> = <em>, <del>/<strike> = <s> (the theme styles them alike) when they have no
 *     attributes; empty ones of those (they show nothing) and two of the same written side by side.
 */
import { isElement, parse, Text, type ChildNode, type Element } from "./html";

const BLOCK = new Set(
  "address article aside blockquote center dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav noscript ol p pre script search section style summary table tbody td template tfoot th thead tr ul".split(" "),
);
const TRIM_BOXES = ["elementor-button-text", "elementor-icon-list-text"];
const ALIASES: Record<string, string> = { b: "strong", i: "em", del: "s", strike: "s" };
const DECORATORS = new Set(["strong", "em", "u", "s", "code", "sup", "sub"]);

const isBlock = (node: ChildNode | undefined): boolean =>
  isElement(node) && (BLOCK.has(node.name) || TRIM_BOXES.some((name) => (node.attribs.class ?? "").split(/\s+/).includes(name)));

function collapseAll(nodes: ChildNode[]): ChildNode[] {
  const out: ChildNode[] = [];
  for (const node of nodes) {
    if (node.type === "comment" || node.type === "directive") continue;
    if (node instanceof Text) {
      node.data = node.data.replace(/[ \t\n\r\f]+/g, " ");
      out.push(node);
    } else if (isElement(node)) {
      if (ALIASES[node.name] && !Object.keys(node.attribs).length) node.name = ALIASES[node.name];
      node.children = collapseAll(node.children);
      for (const kid of node.children) kid.parent = node;
      out.push(node);
    } else out.push(node);
  }
  return out;
}

const OPAQUE = new Set(["img", "br", "svg", "iframe", "input", "button", "select", "textarea", "video", "audio", "canvas", "object", "picture"]);

/** Holds no text (yet): an empty text, or an inline element with only such texts inside. */
function isBlank(node: ChildNode): boolean {
  if (node instanceof Text) return node.data === "";
  if (!isElement(node)) return true;
  if (isBlock(node) || OPAQUE.has(node.name)) return false;
  return node.children.every(isBlank);
}

/** Trim spaces at the start of a run of inline content (going into inline elements). */
function trimForward(children: ChildNode[], from: number) {
  for (let i = from; i < children.length; i++) {
    const node = children[i];
    if (isBlock(node)) return;
    if (node instanceof Text) node.data = node.data.replace(/^ +/, "");
    else if (isElement(node) && !OPAQUE.has(node.name)) trimForward(node.children, 0);
    if (!isBlank(node)) return;
  }
}

function trimBackward(children: ChildNode[], from: number) {
  for (let i = from; i >= 0; i--) {
    const node = children[i];
    if (isBlock(node)) return;
    if (node instanceof Text) node.data = node.data.replace(/ +$/, "");
    else if (isElement(node) && !OPAQUE.has(node.name)) trimBackward(node.children, node.children.length - 1);
    if (!isBlank(node)) return;
  }
}

function trimEdges(children: ChildNode[], parentIsBlock: boolean) {
  if (parentIsBlock) {
    trimForward(children, 0);
    trimBackward(children, children.length - 1);
  }
  children.forEach((node, i) => {
    if (!isBlock(node)) return;
    trimBackward(children, i - 1);
    trimForward(children, i + 1);
  });
  for (const node of children) if (isElement(node)) trimEdges(node.children, isBlock(node));
}

function clean(children: ChildNode[]): ChildNode[] {
  const out: ChildNode[] = [];
  for (const node of children) {
    if (isElement(node)) {
      node.children = clean(node.children);
      if (DECORATORS.has(node.name) && !Object.keys(node.attribs).length && !node.children.length) continue;
    }
    if (node instanceof Text && node.data === "") continue;
    const last = out.at(-1);
    if (node instanceof Text && last instanceof Text) {
      last.data += node.data;
      continue;
    }
    if (isElement(node) && isElement(last) && DECORATORS.has(node.name) && node.name === last.name && !Object.keys(node.attribs).length && !Object.keys(last.attribs).length) {
      last.children = clean([...last.children, ...node.children]);
      continue;
    }
    out.push(node);
  }
  return out;
}

function normalizeAttr(name: string, value: string): string {
  if (name === "class") return value.split(/\s+/).filter(Boolean).join(" ");
  if (name === "style")
    return value
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => d.replace(/^([^:]+):\s*/, (_m, p: string) => `${p.trim().toLowerCase()}: `))
      .join("; ");
  return value;
}

function print(nodes: ChildNode[], depth: number, lines: string[]) {
  const pad = "  ".repeat(depth);
  for (const node of nodes) {
    if (node instanceof Text) lines.push(`${pad}"${node.data}"`);
    else if (isElement(node)) {
      const attrs = Object.keys(node.attribs)
        .sort()
        .map((name) => ` ${name}="${normalizeAttr(name, node.attribs[name])}"`)
        .join("");
      lines.push(`${pad}<${node.name}${attrs}>`);
      print(node.children, depth + 1, lines);
    }
  }
}

/** The canonical text of a piece of HTML (one line per element or text). */
export function canonicalHtml(html: string): string {
  const nodes = collapseAll(parse(html));
  trimEdges(nodes, true);
  const lines: string[] = [];
  print(clean(nodes), 0, lines);
  return lines.join("\n");
}

/** null when equal, otherwise the first lines that differ (with a little context). */
export function firstDifference(expected: string, actual: string): string | null {
  const a = canonicalHtml(expected).split("\n");
  const b = canonicalHtml(actual).split("\n");
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 3);
      return [`line ${i + 1}`, "expected:", ...a.slice(from, i + 4), "actual:", ...b.slice(from, i + 4)].join("\n");
    }
  }
  return null;
}

export type { Element };
