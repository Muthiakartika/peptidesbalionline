// Builds the Sanity documents from the content copied from the live site (src/content/): the
// Elementor pages, the homepage popups, the block under "Add to cart" on every product page, and the
// sections that several pages share (copies of one section, each with its own Elementor ids).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { keyFor, parse } from "./dom.mjs";
import { convertDocument, convertSection, sectionSignature } from "./elementor.mjs";
import { htmlToRichText } from "./rich-text.mjs";

const SITE_SUFFIX = / [-–|] Atlas Longevity$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** The pages listed in src/content/pages/index.ts: { address: name }. */
export function readPageIndex(root) {
  const source = fs.readFileSync(path.join(root, "src/content/pages/index.ts"), "utf8");
  return Object.fromEntries([...source.matchAll(/"([^"]+)": "([^"]+)",/g)].map((m) => [m[1], m[2]]));
}

function seoFields(seo) {
  if (!seo) return undefined;
  return {
    _type: "pageSeo",
    title: seo.title ?? "",
    description: seo.description ?? "",
    robots: seo.robots ?? "",
    ogType: seo.ogType ?? "",
    ogTitle: seo.ogTitle ?? "",
    ogDescription: seo.ogDescription ?? "",
  };
}

/** A page's Elementor sections, with the top-level section nodes' signatures (to find shared ones). */
function documentWithSignatures(html, seed) {
  const document = convertDocument(html, seed);
  const root = parse(html).find((n) => n.type === "tag");
  const tops = root.children.filter((n) => n.type === "tag");
  return { ...document, signatures: tops.map(sectionSignature) };
}

export function convertPage(page, name) {
  const title = (page.seo?.title ?? name).replace(SITE_SUFFIX, "").trim();
  const base = {
    _id: `page-${name}`,
    _type: "page",
    title,
    name,
    path: page.path,
    family: page.family,
    docId: page.docId,
    articleClass: page.articleClass ?? "",
    ...(page.pageTitleHtml ? { pageTitleHtml: page.pageTitleHtml } : {}),
    stylesheets: page.stylesheets ?? [],
    ...(page.toolConfig ? { toolConfig: page.toolConfig } : {}),
    ...(page.toolScripts ? { toolScripts: page.toolScripts } : {}),
    seo: seoFields(page.seo),
  };
  if (page.plain) {
    const { blocks, meta } = htmlToRichText(parse(page.html), `page:${name}:body`);
    return { doc: { ...base, plain: true, body: blocks, bodyMeta: JSON.stringify(meta) }, signatures: [] };
  }
  const { rootAttrs, sections, signatures } = documentWithSignatures(page.html, `page:${name}`);
  return { doc: { ...base, plain: false, rootAttrs, sections }, signatures };
}

/**
 * Sections that are copies of each other on two or more pages become one "sharedSection" document;
 * each page keeps a reference to it plus its own copy's Elementor ids ("skin"), which its CSS needs.
 */
export function shareRepeatedSections(converted) {
  const groups = new Map();
  for (const { doc, signatures } of converted) {
    signatures.forEach((signature, index) => {
      if (!groups.has(signature)) groups.set(signature, []);
      groups.get(signature).push({ doc, index });
    });
  }
  const shared = [];
  for (const [signature, uses] of groups) {
    if (new Set(uses.map((u) => u.doc._id)).size < 2) continue;
    const first = uses[0].doc.sections[uses[0].index];
    const id = `sharedSection-${keyFor(signature)}`;
    shared.push({
      _id: id,
      _type: "sharedSection",
      title: `${first.label} (${uses.length} pages)`,
      sections: [{ ...first, _key: keyFor(`${id}:0`) }],
    });
    for (const { doc, index } of uses) {
      const own = doc.sections[index];
      doc.sections[index] = {
        _type: "sharedSectionRef",
        _key: own._key,
        section: { _type: "reference", _ref: id },
        skin: JSON.stringify({ sections: [{ layout: own.layout, wrappers: own.slots.map((slot) => slot.widgets.map((w) => w.wrapper ?? null)) }] }),
      };
    }
  }
  return shared;
}

export function convertPopup(popup) {
  const { rootAttrs, sections } = convertDocument(popup.html, `popup:${popup.id}`);
  const label = sections[0]?.label ?? `Popup ${popup.id}`;
  return { _id: `popup-${popup.id}`, _type: "popup", title: `${label} (#${popup.id})`, popupId: popup.id, settings: JSON.stringify(popup.settings ?? {}), rootAttrs, sections };
}

/** An Elementor block shown on many pages, e.g. #701 under "Add to cart" on every product page. */
export function convertBlock(id, html, title) {
  const { rootAttrs, sections } = convertDocument(html, `block:${id}`);
  return { _id: `sharedSection-block-${id}`, _type: "sharedSection", title, docId: id, rootAttrs, sections };
}

/** src/content/site-chrome.ts (TypeScript), loaded by compiling it on the fly. */
async function readSiteChrome(root) {
  const ts = createRequire(path.join(root, "package.json"))("typescript");
  const source = fs.readFileSync(path.join(root, "src/content/site-chrome.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

const keyed = (items, type, seed, map = (x) => x) => items.map((item, i) => ({ _type: type, _key: keyFor(`${seed}:${i}`), ...map(item, `${seed}:${i}`) }));

/** The "Site settings" document: top bar, main menu, footer, age gate texts, cookie bar. */
export async function convertSiteChrome(root) {
  const chrome = await readSiteChrome(root);
  const nav = (items, seed) => keyed(items, "navLink", seed, ({ children, ...item }, here) => ({ ...item, ...(children ? { children: nav(children, here) } : {}) }));
  const columns = (items, seed) => keyed(items, "footerColumn", seed, (column, here) => ({ ...column, links: keyed(column.links, "footerLink", `${here}:links`) }));
  const { footer, ageGate, cookieNotice } = chrome;
  return {
    _id: "siteSettings",
    _type: "siteSettings",
    announcements: keyed(chrome.announcements, "announcement", "announcements"),
    mainMenu: nav(chrome.mainMenu, "menu"),
    footer: { ...footer, topColumns: columns(footer.topColumns, "footer:top"), linkColumns: columns(footer.linkColumns, "footer:links") },
    ageGate: Object.fromEntries(["eyebrow", "title", "englishBefore", "englishBrand", "englishAfter", "indonesian", "enterLabel", "backLabel", "footnote"].map((k) => [k, ageGate[k]])),
    cookieNotice: { ...cookieNotice },
  };
}

/** The blog posts: their text as rich text (title, slug and date for finding them in the Studio). */
export function convertPosts(root) {
  const list = readJson(path.join(root, "src/content/blog/posts.json"));
  return list.map((post) => {
    const { html } = readJson(path.join(root, "src/content/blog/posts", `${post.slug}.json`));
    const { blocks, meta } = htmlToRichText(parse(html), `post:${post.slug}`);
    return {
      _id: `post-${post.slug}`,
      _type: "post",
      title: post.title,
      slug: { _type: "slug", current: post.slug },
      publishedAt: `${post.date}Z`,
      legacyWpId: Number(post.id),
      body: blocks,
      bodyMeta: JSON.stringify(meta),
    };
  });
}

/** The products' content (texts only; prices and stock never go to Sanity). */
export function convertProducts(root) {
  const catalog = readJson(path.join(root, "src/content/catalog.json"));
  const { pages } = readJson(path.join(root, "src/content/product-pages.json"));
  const rich = (html, seed) => {
    if (!html) return {};
    const { blocks, meta } = htmlToRichText(parse(html), seed);
    return { blocks, meta: JSON.stringify(meta) };
  };
  return catalog.products
    .filter((product) => pages[product.path])
    .map((product) => {
      const page = pages[product.path];
      const short = rich(page.shortDescription, `product:${product.slug}:short`);
      const formats = rich(page.connectedFormats, `product:${product.slug}:formats`);
      return {
        _id: `product-${product.slug}`,
        _type: "product",
        name: product.name,
        slug: { _type: "slug", current: product.slug },
        productType: product.type,
        legacyWooId: product.id,
        shopId: product.id,
        storeStatus: "publish",
        ...(short.blocks ? { shortDescription: short.blocks, shortDescriptionMeta: short.meta } : {}),
        ...(page.includedSupplies ? { includedSupplies: page.includedSupplies } : {}),
        ...(formats.blocks ? { connectedFormats: formats.blocks, connectedFormatsMeta: formats.meta } : {}),
        tabs: page.tabs.map((tab, i) => {
          const body = rich(tab.html, `product:${product.slug}:tab${i}`);
          return { _type: "productTab", _key: keyFor(`product:${product.slug}:tab${i}`), key: tab.key, title: tab.title, ...(body.blocks ? { body: body.blocks, bodyMeta: body.meta } : {}) };
        }),
      };
    });
}

/** Everything, ready to send to Sanity. */
export function buildContent(root) {
  const index = readPageIndex(root);
  const converted = Object.values(index).map((name) => convertPage(readJson(path.join(root, "src/content/pages", `${name}.json`)), name));
  const shared = shareRepeatedSections(converted);
  const popups = fs
    .readdirSync(path.join(root, "src/content/popups"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => convertPopup(readJson(path.join(root, "src/content/popups", f))));
  const productPages = readJson(path.join(root, "src/content/product-pages.json"));
  const blocks = Object.entries(productPages.blocks).map(([id, html]) => convertBlock(Number(id), html, `Product pages: under "Add to cart" (#${id})`));
  return { pages: converted.map((c) => c.doc), shared: [...shared, ...blocks], popups, posts: convertPosts(root), products: convertProducts(root) };
}

export { convertSection };
