/**
 * Copies what Yoast prints for link previews and dates on every address of the live sitemaps:
 * og:image (+ width, height, type), article:published_time, article:modified_time, og:type, and the robots
 * line (to check the rebuild's own copy). Output: src/content/seo/open-graph.json, keyed by path, read by
 * src/components/shop/archive-metadata.ts. Re-run before launch to pick up new pages and pictures:
 *
 *   node scripts/audit/export-open-graph.mjs
 *
 * Read-only: GET requests to the public site, a few at a time.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIVE = "https://peptidesbali.online";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
const decode = (t) =>
  String(t ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

function meta(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() === key) return decode(tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1] ?? "");
  }
  return "";
}

const get = async (url) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await (await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) })).text();
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
};

const index = await get(`${LIVE}/sitemap_index.xml`);
const paths = [];
for (const sm of [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))) {
  const xml = await get(sm);
  paths.push(...[...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => new URL(decode(m[1])).pathname));
}
const unique = [...new Set(["/", "/shop/", ...paths])];
console.log(`${unique.length} addresses`);

const pages = {};
for (let i = 0; i < unique.length; i += 4) {
  await Promise.all(
    unique.slice(i, i + 4).map(async (p) => {
      const html = await get(LIVE + p);
      const image = meta(html, "og:image");
      const entry = {
        ogType: meta(html, "og:type") || null,
        robots: meta(html, "robots") || null,
        ...(image
          ? {
              image: {
                url: image.replace(LIVE, ""),
                width: Number(meta(html, "og:image:width")) || null,
                height: Number(meta(html, "og:image:height")) || null,
                type: meta(html, "og:image:type") || null,
              },
            }
          : {}),
        ...(meta(html, "article:published_time") ? { publishedTime: meta(html, "article:published_time") } : {}),
        ...(meta(html, "article:modified_time") ? { modifiedTime: meta(html, "article:modified_time") } : {}),
      };
      pages[p] = entry;
    }),
  );
}
const sorted = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(
  path.join(ROOT, "src/content/seo/open-graph.json"),
  JSON.stringify({ source: "Yoast's Open Graph tags and robots line on every address of the live sitemaps (scripts/audit/export-open-graph.mjs)", generatedAt: new Date().toISOString(), pages: sorted }, null, 1) + "\n",
);
const counts = (key) => Object.values(sorted).filter((e) => e[key]).length;
console.log(`written: ${Object.keys(sorted).length} pages, image ${counts("image")}, published ${counts("publishedTime")}, modified ${counts("modifiedTime")}`);
const types = {};
for (const e of Object.values(sorted)) types[e.ogType] = (types[e.ogType] ?? 0) + 1;
const robots = {};
for (const e of Object.values(sorted)) robots[e.robots] = (robots[e.robots] ?? 0) + 1;
console.log("og:type", types, "\nrobots", robots);
