/**
 * SEO parity against the live site AS IT IS TODAY: every address in live's sitemaps (fetched now) is requested
 * on live and on the rebuild (BASE_URL), and what search engines and link previews read is compared:
 * status, redirect target, <title>, meta description, canonical, robots, Open Graph (title, description, type,
 * url, image), Twitter card, the JSON-LD types, and the H1.
 *
 *   BASE_URL=http://localhost:3000 node scripts/verification/seo-live-parity.mjs
 *   ONLY=/product/ node scripts/verification/seo-live-parity.mjs          (addresses containing "/product/")
 *
 * Addresses are compared by path (the rebuild's own address may be localhost or Vercel). A test site is
 * noindex everywhere on purpose (SITE_ENV isn't "production"), so robots is only compared when the rebuild
 * says anything other than that blanket noindex.
 * Output: test-results/seo-live-parity.md (+ .json). Read-only: GET requests, a few at a time.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LIVE = "https://peptidesbali.online";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const ONLY = process.env.ONLY ?? "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—", hellip: "…" };
const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

/** The value of <meta name|property="key" content="…"> whatever the attribute order. */
function meta(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() === key) return decode(tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1] ?? "");
  }
  return "";
}

const pathOf = (url) => {
  if (!url) return "";
  try {
    const u = new URL(decode(url), LIVE);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};
const fileOf = (url) => (url ? decodeURIComponent(new URL(decode(url), LIVE).pathname.split("/").pop() ?? "").replace(/-\d+x\d+(?=\.\w+$)/, "") : "");

function jsonLdTypes(html) {
  const types = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (node["@type"]) [].concat(node["@type"]).forEach((t) => types.add(t));
    Object.values(node).forEach(visit);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      types.add("(invalid JSON-LD)");
    }
  }
  return [...types].sort().join(", ");
}

function extract(html) {
  return {
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: meta(html, "description"),
    canonical: pathOf(html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1] ?? html.match(/<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i)?.[1] ?? ""),
    robots: meta(html, "robots").toLowerCase().replace(/\s+/g, ""),
    "og:title": meta(html, "og:title"),
    "og:description": meta(html, "og:description"),
    "og:type": meta(html, "og:type"),
    "og:url": pathOf(meta(html, "og:url")),
    "og:image": fileOf(meta(html, "og:image")),
    "twitter:card": meta(html, "twitter:card"),
    jsonld: jsonLdTypes(html),
    h1: decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")),
  };
}

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { redirect: "manual", headers: { "user-agent": UA }, signal: AbortSignal.timeout(90_000) });
      const location = r.headers.get("location");
      return { status: r.status, location: location ? pathOf(location) : "", html: r.status === 200 ? await r.text() : "" };
    } catch (error) {
      if (attempt >= 3) return { status: 0, location: "", html: "", error: String(error.cause?.code ?? error.message) };
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function sitemapUrls() {
  const index = await (await fetch(`${LIVE}/sitemap_index.xml`, { headers: { "user-agent": UA } })).text();
  const urls = [];
  for (const sm of [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))) {
    const xml = await (await fetch(sm, { headers: { "user-agent": UA } })).text();
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(m[1])));
  }
  return [...new Set(urls)];
}

// What a test site writes on every page (SITE_ENV isn't "production"): not a difference to report.
const BLANKET_NOINDEX = /^noindex/;

async function compare(urlPath) {
  const [live, ours] = await Promise.all([get(LIVE + urlPath), get(BASE_URL + urlPath)]);
  const problems = [];
  if (live.status !== ours.status) problems.push({ field: "status", live: String(live.status), ours: `${ours.status}${ours.error ? ` (${ours.error})` : ""}` });
  if (live.location !== ours.location && (live.location || ours.location)) problems.push({ field: "redirect", live: live.location, ours: ours.location });
  if (live.status === 200 && ours.status === 200) {
    const a = extract(live.html);
    const b = extract(ours.html);
    for (const field of Object.keys(a)) {
      if (field === "robots" && BLANKET_NOINDEX.test(b.robots)) continue;
      if (a[field] !== b[field]) problems.push({ field, live: a[field], ours: b[field] });
    }
  }
  return { path: urlPath, problems };
}

const urls = (await sitemapUrls()).filter((u) => u.includes(ONLY));
console.log(`${urls.length} addresses from live's sitemaps; comparing with ${BASE_URL} …`);
const results = [];
for (let i = 0; i < urls.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(urls.slice(i, i + CONCURRENCY).map(compare))));
  if ((i / CONCURRENCY) % 20 === 0) console.log(`  ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length}`);
}

const byField = {};
for (const r of results) for (const p of r.problems) (byField[p.field] ??= []).push({ path: r.path, ...p });
const clean = results.filter((r) => !r.problems.length).length;
const lines = [
  `# SEO parity with the live site (${new Date().toISOString().slice(0, 10)})`,
  "",
  `${urls.length} addresses from live's sitemaps, rebuild at ${BASE_URL}. Identical: **${clean}**. With a difference: **${urls.length - clean}**.`,
  "",
  "| Field | Addresses that differ |",
  "|---|---|",
  ...Object.entries(byField).map(([field, list]) => `| ${field} | ${list.length} |`),
  "",
];
for (const [field, list] of Object.entries(byField)) {
  lines.push(`## ${field}`, "", "| Address | Live | Rebuild |", "|---|---|---|");
  for (const p of list) lines.push(`| \`${p.path}\` | ${String(p.live).replace(/\|/g, "\\|") || "—"} | ${String(p.ours).replace(/\|/g, "\\|") || "—"} |`);
  lines.push("");
}
await mkdir(path.join(ROOT, "test-results"), { recursive: true });
await writeFile(path.join(ROOT, "test-results", "seo-live-parity.md"), lines.join("\n"));
await writeFile(path.join(ROOT, "test-results", "seo-live-parity.json"), JSON.stringify(results, null, 1));
console.log(lines.slice(0, 8 + Object.keys(byField).length).join("\n"));
process.exitCode = clean === urls.length ? 0 : 1;
