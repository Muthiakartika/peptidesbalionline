/**
 * Small helpers for the redesigned blog (src/components/insights/): plain text out of WordPress
 * HTML, reading time, and ids on the post's H2 headings so the "On this page" list can link to them.
 */
import { domutils, parse } from "@/lib/content/render/html";

/** The text inside some HTML, with entities decoded ("Anti-Ageing &amp; Longevity" -> "Anti-Ageing & Longevity"). */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return domutils.textContent(parse(html)).replace(/\s+/g, " ").trim();
}

/** Minutes to read a post, at about 220 words a minute (never less than 1). */
export function readingMinutes(html: string): number {
  const words = plainText(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export type ArticleHeading = { id: string; text: string };

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "section";

/** "what-is-bpc-157-guide" out of ".../what-is-bpc-157-guide.jpg-859x1024.webp" (the picture's own name, without sizes and extensions). */
const pictureName = (src: string) => decodeURIComponent(src.split(/[?#]/)[0].split("/").pop() ?? "").split(".")[0].replace(/-\d+x\d+$/, "");

/**
 * Many older posts start their text with the same picture as the post's header picture. The new
 * header already shows it, so that first copy (with its caption) is left out of the text. Only a
 * picture before the post's second heading counts; nothing else changes.
 */
export function withoutRepeatedPicture(html: string, headerSrc: string | null | undefined): string {
  const name = headerSrc ? pictureName(headerSrc) : "";
  if (name.length < 6) return html;
  const first = html.search(/<h2\b/i);
  const second = first === -1 ? -1 : html.slice(first + 3).search(/<h2\b/i);
  const secondHeading = second === -1 ? html.length : first + 3 + second;
  const candidates = [/<div\b[^>]*class="[^"]*\bwp-caption\b[^"]*"[^>]*>[\s\S]*?<\/div>/i, /<figure\b[\s\S]*?<\/figure>/i, /<p>\s*(?:<a\b[^>]*>)?\s*<img\b[^>]*>\s*(?:<\/a>)?\s*<\/p>/i, /<img\b[^>]*>/i];
  for (const pattern of candidates) {
    const match = pattern.exec(html);
    if (!match || match.index > secondHeading) continue;
    const firstImg = /<img\b[^>]*>/i.exec(match[0]);
    const src = firstImg ? (/\ssrc="([^"]+)"/i.exec(firstImg[0])?.[1] ?? "") : "";
    if (src && pictureName(src) === name) return html.slice(0, match.index) + html.slice(match.index + match[0].length);
  }
  return html;
}

/** Puts each table in a box that scrolls sideways on small screens (styled in insights.css). */
export function withTableBoxes(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => `<div class="ins-table">${table}</div>`);
}

/**
 * Gives every <h2> of the post an id (keeps the ones it already has) and returns the list of
 * headings, in order, for the table of contents.
 */
export function withHeadingIds(html: string): { html: string; headings: ArticleHeading[] } {
  const headings: ArticleHeading[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs: string, inner: string) => {
    const text = plainText(inner);
    if (!text) return match;
    const existing = /\sid\s*=\s*"([^"]+)"/i.exec(attrs)?.[1];
    let id = existing ?? slugify(text);
    if (!existing) {
      const base = id;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    }
    used.add(id);
    headings.push({ id, text });
    return existing ? match : `<h2 id="${id}"${attrs}>${inner}</h2>`;
  });
  return { html: out, headings };
}
