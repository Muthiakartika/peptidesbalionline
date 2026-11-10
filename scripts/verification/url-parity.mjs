/**
 * SEO parity check: requests every URL from the Phase 1 crawl on another base URL (the Next.js
 * app) and checks it behaves like WordPress did: same status code, same redirect target,
 * same <title>, meta description, canonical path, index/noindex and H1.
 *
 *   BASE_URL=http://localhost:3000 npm run verify:urls
 *   BASE_URL=https://staging.example.com TYPES=product,page npm run verify:urls
 *
 * Expected values come from docs/audit/data/page-inventory.json (the live site on 3 Nov 2026).
 * Output: test-results/url-parity.md. Exit code 1 when anything differs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TYPES = process.env.TYPES ? new Set(process.env.TYPES.split(",")) : null;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const LIVE_ORIGIN = "https://peptidesbali.online";

const NAMED_ENTITIES = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—", hellip: "…",
};

// Turns "&ldquo;bpc&rdquo;" / "&#8211;" / "&#x2013;" into real characters so WordPress and
// Next.js output compare equal even when one escapes characters and the other doesn't.
const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();

function extract(html) {
  const pick = (regex) => decode(html.match(regex)?.[1] ?? "");
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    canonical: pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
    robots: pick(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i),
    h1: decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")),
  };
}

const pathOf = (url) => {
  if (!url) return "";
  const parsed = new URL(url, LIVE_ORIGIN);
  return parsed.pathname + parsed.search;
};
const indexState = (robots) => (/noindex/i.test(robots) ? "noindex" : "index");

async function check(page) {
  const urlPath = pathOf(page.url);
  const expected = {
    status: page.status,
    redirect: page.redirected ? pathOf(page.final_url) : "",
    title: decode(page.title ?? ""),
    description: decode(page.meta_description ?? ""),
    canonical: pathOf(page.canonical),
    index: indexState(page.robots ?? ""),
    h1: decode(page.headings?.find((h) => h.tag === "h1")?.text ?? ""),
  };
  let response;
  // Network hiccups (timeouts, rate limits) are retried twice so they are not reported as SEO problems.
  for (let attempt = 1; attempt <= 3 && !response; attempt++) {
    try {
      response = await fetch(BASE_URL + urlPath, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    } catch (error) {
      if (attempt === 3) return { urlPath, problems: [`request failed: ${error.cause?.code ?? error.message}`] };
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }

  const problems = [];
  if (expected.redirect) {
    const location = pathOf(response.headers.get("location") ?? "");
    if (![301, 302, 307, 308].includes(response.status)) problems.push(`expected redirect, got ${response.status}`);
    else if (location !== expected.redirect) problems.push(`redirects to ${location}, expected ${expected.redirect}`);
    return { urlPath, problems };
  }
  if (response.status !== expected.status) {
    problems.push(`status ${response.status}, expected ${expected.status}`);
    return { urlPath, problems };
  }
  if (expected.status !== 200) return { urlPath, problems };

  const actual = extract(await response.text());
  if (actual.title !== expected.title) problems.push(`title "${actual.title}" ≠ "${expected.title}"`);
  if (actual.description !== expected.description) problems.push("meta description differs");
  if (pathOf(actual.canonical) !== expected.canonical) problems.push(`canonical ${pathOf(actual.canonical) || "(none)"} ≠ ${expected.canonical || "(none)"}`);
  // Non-production deployments are always noindex on purpose; only compare on production.
  if (process.env.CHECK_ROBOTS === "1" && indexState(actual.robots) !== expected.index) problems.push(`robots ${indexState(actual.robots)} ≠ ${expected.index}`);
  if (actual.h1 !== expected.h1) problems.push(`H1 "${actual.h1}" ≠ "${expected.h1}"`);
  return { urlPath, problems };
}

async function main() {
  const inventory = JSON.parse(await readFile(path.join(ROOT, "docs", "audit", "data", "page-inventory.json"), "utf8"));
  const pages = inventory.pages.filter((p) => !TYPES || TYPES.has(p.type));
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < pages.length) {
        const page = pages[next++];
        results.push({ type: page.type, ...(await check(page)) });
      }
    }),
  );
  results.sort((a, b) => a.urlPath.localeCompare(b.urlPath));
  const failed = results.filter((r) => r.problems.length > 0);
  const lines = [
    "# URL parity report",
    "",
    `Base URL: ${BASE_URL} · ${results.length - failed.length} of ${results.length} URLs match the live site (3 Nov 2026 crawl).`,
    "",
    "| URL | Type | Problems |",
    "|---|---|---|",
    ...failed.map((r) => `| \`${r.urlPath}\` | ${r.type} | ${r.problems.join("; ").replace(/\|/g, "\\|")} |`),
    "",
  ];
  await mkdir(path.join(ROOT, "test-results"), { recursive: true });
  await writeFile(path.join(ROOT, "test-results", "url-parity.md"), lines.join("\n"), "utf8");
  console.log(`${results.length - failed.length}/${results.length} URLs match. Report: test-results/url-parity.md`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main();
