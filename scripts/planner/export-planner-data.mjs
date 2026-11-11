#!/usr/bin/env node
// Snapshot of the live Protocol Builder (https://peptidesbali.online/protocol-builder/), the owner's
// "Atlas Research Planner" plugin (GPL-2.0-or-later). The rebuilt page (src/app/(store)/protocol-builder/)
// and its API (src/app/api/atlas-planner/v1/) answer from these files.
//
//   node scripts/planner/export-planner-data.mjs
//
// It only READS: plain GET requests of the plugin's public REST routes (/wp-json/atlas-planner/v1/…)
// and of the page itself. It never sends anything that would create data on the live site (no cart,
// no saved protocols, no exports). Each address gets an unused "_fresh=<time>" argument, because
// Cloudflare otherwise answers with an old cached copy. Safe to run again: every file is rewritten.
//
// Output (generated, do not edit by hand), in src/content/planner/:
//   page.json             the page's markup (the title band and the planner's HTML, without its JSON
//                         configuration), that configuration (without addresses and nonces: the page
//                         builds those itself), the WordPress page id and the Yoast SEO tags;
//   settings.json         GET /session without anything personal or secret (no nonces, no user, no date):
//                         features, limits, currency, locale, time zone;
//   catalog.json          GET /catalog, every page, in the order live returns them, + the format list;
//   categories.json       GET /catalog/categories;
//   combinations.json     GET /combinations;
//   products.json         GET /product/{id} of every catalogue product (the capacity mappings the
//                         calculation needs), by id;
//   store-protocols.json  GET /store-protocols (every page) and GET /store-protocols/{id} of each.
//
// Addresses: links to pages of the live site become site-relative ("/product/bpc-157/"). Pictures
// (/wp-content/uploads/…) keep their live address, like the rest of the site's copies; the code that
// reads these files moves them to the media bucket (withMediaUrls, src/lib/media/url.ts).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(root, "src", "content", "planner");
const SITE = "https://peptidesbali.online";
const API = `${SITE}/wp-json/atlas-planner/v1/`;
// A generic browser, like the other snapshot scripts (nothing that names the owner).
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
/** The catalogue's largest page (the route's own limit). */
const PER_PAGE = 48;
/** The store protocol list's largest page. */
const PROTOCOL_LIMIT = 50;

/** A copy of an object without some keys. */
const without = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET one address (with "_fresh" so Cloudflare answers from WordPress). Returns the text. */
async function get(url, accept = "application/json") {
  const address = new URL(url);
  address.searchParams.set("_fresh", String(Date.now()));
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(address, { headers: { "User-Agent": USER_AGENT, Accept: accept } });
    const text = await response.text();
    if (response.ok) return text;
    if (attempt >= 3 || response.status < 500) throw new Error(`${response.status} for ${address.pathname}${address.search}`);
    await sleep(2000 * attempt);
  }
}

async function api(route, query = {}) {
  const url = new URL(route, API);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const data = JSON.parse(await get(url.href));
  await sleep(250); // gently: one request at a time
  return data;
}

/** Links to the live site's pages -> site-relative; pictures (/wp-content/…) keep their address. */
function relativeLinks(value) {
  const text = JSON.stringify(value)
    .replace(/"https?:\/\/(?:www\.)?peptidesbali\.online(\/(?!wp-content\/)[^"]*)?"/g, (_m, rest) => JSON.stringify(rest ?? "/"));
  return JSON.parse(text);
}

/** The same for HTML attributes (href / action). */
function relativeHtml(html) {
  return html.replace(/(href|action)="https?:\/\/(?:www\.)?peptidesbali\.online(\/(?!wp-content\/)[^"]*)?"/gi, (_m, attribute, rest) => `${attribute}="${rest ?? "/"}"`);
}

function write(name, data) {
  fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(data, null, 1)}\n`, "utf8");
  console.log(`src/content/planner/${name}`);
}

/** Text of an HTML attribute value as the browser reads it. */
const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function meta(html, attribute, name) {
  const tag = html.match(new RegExp(`<meta[^>]*${attribute}=["']${name}["'][^>]*>`, "i"))?.[0];
  const content = tag?.match(/content=(["'])([\s\S]*?)\1/i)?.[2];
  return content === undefined ? null : decode(content);
}

/** The page: title band, the planner's markup, its configuration and the SEO tags. */
async function exportPage() {
  const html = await get(`${SITE}/protocol-builder/`, "text/html");
  const titleBand = html.match(/<div class="wd-page-title [\s\S]*?<\/nav>\s*<\/div>\s*<\/div>/)?.[0];
  const article = html.match(/<article id="post-(\d+)" class="([^"]*)">([\s\S]*?)<\/article>/);
  if (!titleBand || !article) throw new Error("the page's title band or article was not found");
  const [, postId, articleClass, inner] = article;
  const configTag = inner.match(/<script type="application\/json" id="arp-config">([\s\S]*?)<\/script>/);
  if (!configTag) throw new Error("script#arp-config was not found");
  const config = JSON.parse(configTag[1]);
  // The page builds these itself: its own API address and its own pages (cart, checkout, …).
  delete config.rest_root;
  delete config.urls;
  const configText = JSON.stringify(config);
  if (/nonce|token|secret/i.test(configText)) throw new Error("the configuration holds a nonce or token: not saved");
  // The configuration is printed by the page (with this site's addresses) where the live page prints
  // it: this mark stands in its place.
  let body = inner.replace(configTag[0], "<!--arp-config-->").trim();
  // The stylesheet comes from this site (public/legacy/vendor/atlas-research-planner/planner.css).
  body = body.replace(/<link rel="stylesheet" id="arp-planner-inline-css" href="[^"]*"/, '<link rel="stylesheet" id="arp-planner-inline-css" href="/legacy/vendor/atlas-research-planner/planner.css"');
  if (!body.includes("/legacy/vendor/atlas-research-planner/planner.css")) throw new Error("the planner stylesheet link was not found");
  const scriptSrc = html.match(/<script id="arp-planner-js" src="([^"]+)"/)?.[1];
  if (!scriptSrc) throw new Error("the planner script was not found");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  write("page.json", {
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    path: "/protocol-builder/",
    postId: Number(postId),
    articleClass,
    pageTitleHtml: relativeHtml(titleBand),
    html: relativeHtml(body),
    config,
    // The plugin version of the vendored planner.js / planner.css (?ver= of the live files).
    assetVersion: new URL(scriptSrc).searchParams.get("ver"),
    seo: {
      title: decode(title ?? ""),
      description: meta(html, "name", "description"),
      robots: meta(html, "name", "robots"),
      ogType: meta(html, "property", "og:type"),
      ogTitle: meta(html, "property", "og:title"),
      ogDescription: meta(html, "property", "og:description"),
    },
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await exportPage();

  // GET /session: only what is the same for every visitor.
  const session = await api("session");
  write("settings.json", {
    features: session.features,
    limits: session.limits,
    currency: session.currency,
    locale: session.locale,
    timezone: session.timezone,
  });

  // The catalogue, page by page, in live's order.
  const items = [];
  let formats = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const data = await api("catalog", { page, per_page: PER_PAGE });
    items.push(...data.items);
    pages = data.pages;
    formats = data.formats;
    if (page === 1) console.log(`catalog: ${data.total} products, ${data.pages} pages of ${PER_PAGE}`);
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("the catalogue pages overlap (it changed while reading?)");
  write("catalog.json", relativeLinks({ generatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"), formats, items: items.map((item) => without(item, ["fetched_at"])) }));

  write("categories.json", relativeLinks(await api("catalog/categories")));
  write("combinations.json", relativeLinks(await api("combinations")));

  // Store protocols ("pre-built protocols"): the list and each one.
  const protocols = [];
  let list = null;
  for (let offset = 0; ; offset += PROTOCOL_LIMIT) {
    const data = await api("store-protocols", { offset, limit: PROTOCOL_LIMIT });
    list ??= data;
    protocols.push(...data.items);
    if (data.items.length < PROTOCOL_LIMIT || protocols.length >= data.total) break;
  }
  const details = {};
  for (const item of protocols) details[item.id] = await api(`store-protocols/${encodeURIComponent(item.id)}`);
  // The list's own paging (items, total, offset, limit) is worked out again by the API.
  write("store-protocols.json", relativeLinks({ ...without(list, ["items", "total", "offset", "limit"]), items: protocols, details }));

  // Every catalogue product's detail (and every product a store protocol or combination names).
  const ids = new Set(items.map((item) => item.id));
  for (const detail of Object.values(details)) for (const line of detail.plan?.lines ?? []) if (line.product_id) ids.add(line.product_id);
  for (const combo of (await api("combinations")).items ?? []) for (const item of combo.items ?? []) if (item.product_id) ids.add(item.product_id);
  const products = {};
  let n = 0;
  for (const id of ids) {
    const data = await api(`product/${id}`);
    // "fetched_at" is when live read the product: this site sets its own on every answer.
    delete data.fetched_at;
    for (const unit of data.units ?? []) delete unit.fetched_at;
    products[id] = data;
    if (++n % 20 === 0) console.log(`products: ${n}/${ids.size}`);
  }
  write("products.json", relativeLinks(products));
  console.log(`done: ${items.length} catalogue products, ${Object.keys(products).length} product details, ${protocols.length} store protocols`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
