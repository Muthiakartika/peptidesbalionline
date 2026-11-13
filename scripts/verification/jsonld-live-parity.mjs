/**
 * Structured data (JSON-LD) parity with the live site as it is today: for every address of live's sitemaps
 * the JSON-LD blocks of live and of the rebuild (BASE_URL) are compared field by field (the site's own
 * domain and the picture host are made the same first). Prints which fields differ and how often, with
 * examples; writes test-results/jsonld-live-parity.json.
 *
 *   BASE_URL=http://localhost:3000 node scripts/verification/jsonld-live-parity.mjs
 *   ONLY=/product/ node scripts/verification/jsonld-live-parity.mjs
 *
 * Read-only: GET requests, a few at a time.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LIVE = "https://peptidesbali.online";
const ONLY = process.env.ONLY ?? "";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const OWN = new RegExp(`${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|https?://localhost:\\d+`, "g");
/** The R2 bucket serves the same /wp-content/uploads/ paths as live. */
const BUCKET = /https:\/\/pub-[0-9a-f]+\.r2\.dev/g;

const get = async (url) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(90_000) });
      return r.ok ? await r.text() : "";
    } catch {
      if (attempt >= 3) return "";
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
};

function blocks(html, own) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const text = m[1].replace(own ? OWN : /$^/, LIVE).replace(BUCKET, LIVE);
    try {
      out.push(JSON.parse(text));
    } catch {
      out.push({ invalid: text.slice(0, 80) });
    }
  }
  return out;
}

/** Every leaf as "path = value" (graph nodes keyed by their @type and @id, so their order doesn't count). */
function flatten(node, prefix, out) {
  if (Array.isArray(node)) {
    const keyed = node.every((n) => n && typeof n === "object" && !Array.isArray(n) && (n["@id"] || n["@type"]));
    node.forEach((n, i) => flatten(n, `${prefix}[${keyed ? `${[].concat(n["@type"] ?? "").join("+")}${n["@id"] ? " " + n["@id"].replace(LIVE, "") : ""}` : i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) flatten(v, `${prefix}.${k}`, out);
  } else {
    out.set(prefix, typeof node === "string" ? node.replace(/\s+/g, " ").trim() : node);
  }
  return out;
}

const index = await get(`${LIVE}/sitemap_index.xml`);
const urls = [];
for (const sm of [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
  const xml = await get(sm);
  urls.push(...[...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
}
const list = [...new Set(urls)].filter((u) => u.includes(ONLY));
console.log(`${list.length} addresses; comparing JSON-LD with ${BASE_URL} …`);

const results = [];
for (let i = 0; i < list.length; i += CONCURRENCY) {
  results.push(
    ...(await Promise.all(
      list.slice(i, i + CONCURRENCY).map(async (p) => {
        const [live, ours] = await Promise.all([get(LIVE + p), get(BASE_URL + p)]);
        const a = new Map(),
          b = new Map();
        blocks(live, false).forEach((x, n) => flatten(x, `#${n}`, a));
        blocks(ours, true).forEach((x, n) => flatten(x, `#${n}`, b));
        const diffs = [];
        let intentional = 0;
        for (const key of new Set([...a.keys(), ...b.keys()])) {
          if (a.get(key) === b.get(key)) continue;
          // On purpose: the blog author's Person node (live shows an e-mail address and its Gravatar, Q-14).
          if (/\[Person /.test(key) || /\.author\.name$/.test(key)) intentional++;
          else diffs.push({ key, live: a.get(key), ours: b.get(key) });
        }
        return { path: p, liveFields: a.size, ourFields: b.size, diffs, intentional };
      }),
    )),
  );
}

// Group by the field's name without the page-specific part, to see patterns.
const pattern = (key) => key.replace(/\[[^\]]*\]/g, "[]").replace(/#\d+/, "#");
const byPattern = new Map();
for (const r of results)
  for (const d of r.diffs) {
    const k = pattern(d.key);
    if (!byPattern.has(k)) byPattern.set(k, { count: 0, example: { path: r.path, ...d } });
    byPattern.get(k).count++;
  }
const same = results.filter((r) => !r.diffs.length).length;
console.log(`identical: ${same} / ${results.length}; pages without JSON-LD on live: ${results.filter((r) => !r.liveFields).length}, here: ${results.filter((r) => !r.ourFields).length}`);
console.log(`pages that differ only in the author's Person node (on purpose, Q-14): ${results.filter((r) => !r.diffs.length && r.intentional).length}`);
for (const [k, v] of [...byPattern].sort((x, y) => y[1].count - x[1].count)) {
  const show = (x) => (x === undefined ? "∅" : JSON.stringify(x).slice(0, 110));
  console.log(`${String(v.count).padStart(4)}  ${k}\n        e.g. ${v.example.path}: live ${show(v.example.live)} | ours ${show(v.example.ours)}`);
}
await mkdir(path.join(ROOT, "test-results"), { recursive: true });
await writeFile(path.join(ROOT, "test-results", "jsonld-live-parity.json"), JSON.stringify(results, null, 1));
