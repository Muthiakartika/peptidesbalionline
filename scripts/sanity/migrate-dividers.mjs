#!/usr/bin/env node
// Turns the HTML blocks that hold only a horizontal line (<hr …>) into "Divider line" blocks, in
// documents already in Sanity (published and drafts). Same result as a fresh import with
// scripts/sanity/lib/rich-text.mjs, without touching anything editors changed.
//
//   node scripts/sanity/migrate-dividers.mjs --dataset staging          # only counts, changes nothing
//   node scripts/sanity/migrate-dividers.mjs --dataset staging --apply  # changes them
//   node scripts/sanity/migrate-dividers.mjs --dataset staging --undo --apply  # back to HTML blocks
//
// The production dataset also needs --yes. Each document is changed only if nobody edited it in the
// meantime (its revision is checked). Reads NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN
// from .env.local (the token is never printed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

import { dividerBlock } from "./lib/rich-text.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));

const dataset = option("dataset");
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const token = process.env.SANITY_API_WRITE_TOKEN;
if (!dataset) throw new Error("Say which dataset: --dataset staging");
if (dataset === "production" && !flag("yes")) throw new Error("The production dataset also needs --yes");
if (!projectId || !token) throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN must be set in .env.local");

const apply = flag("apply");
const undo = flag("undo");
const client = createClient({ projectId, dataset, token, apiVersion: "2026-11-01", useCdn: false, perspective: "raw" });

/** `<hr>` with its attributes, as the HTML parser gives them (names lower case, values unescaped). */
const HR = /^\s*<hr\b((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>\s*$/;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const unescape = (value) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const escape = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function hrAttribs(html) {
  const match = HR.exec(html ?? "");
  if (!match) return null;
  const attribs = {};
  for (const [, name, double, single, bare] of match[1].matchAll(ATTR)) attribs[name.toLowerCase()] = unescape(double ?? single ?? bare ?? "");
  return attribs;
}

/** The block changed, or null to leave it. */
function convert(block) {
  if (!block || typeof block !== "object") return null;
  if (!undo && block._type === "htmlBlock") {
    const attribs = hrAttribs(block.html);
    return attribs ? { ...dividerBlock(attribs, "unused"), _key: block._key } : null;
  }
  if (undo && block._type === "dividerBlock") {
    const attribs = block.attrs ? JSON.parse(block.attrs) : {};
    const attrs = Object.entries(attribs)
      .map(([name, value]) => (value === "" ? ` ${name}` : ` ${name}="${escape(value)}"`))
      .join("");
    return { _type: "htmlBlock", _key: block._key, html: `<hr${attrs}>` };
  }
  return null;
}

/** A copy of `value` with every matching block replaced, and how many were. */
function walk(value) {
  if (Array.isArray(value)) {
    let count = 0;
    const out = value.map((item) => {
      const replaced = convert(item);
      if (replaced) {
        count++;
        return replaced;
      }
      const inner = walk(item);
      count += inner.count;
      return inner.value;
    });
    return { value: out, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const inner = walk(item);
      count += inner.count;
      out[key] = inner.value;
    }
    return { value: out, count };
  }
  return { value, count: 0 };
}

// Every document, drafts included ("raw" perspective), except Sanity's own (_.*).
const ids = await client.fetch(`*[!(_id in path("_.**"))]._id`);
const docs = [];
for (let i = 0; i < ids.length; i += 50) docs.push(...(await client.fetch(`*[_id in $ids]`, { ids: ids.slice(i, i + 50) })));
let documents = 0;
let blocks = 0;
const byType = {};
for (const doc of docs) {
  const id = doc._id;
  const fields = {};
  let count = 0;
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith("_")) continue;
    const inner = walk(value);
    if (inner.count) {
      fields[key] = inner.value;
      count += inner.count;
    }
  }
  if (!count) continue;
  documents++;
  blocks += count;
  byType[doc._type] = (byType[doc._type] ?? 0) + count;
  if (apply) {
    await client.patch(id).ifRevisionId(doc._rev).set(fields).commit({ visibility: "async" });
    process.stdout.write(`\r${documents} documents changed`);
  }
}
if (apply) process.stdout.write("\n");
console.log(`${apply ? "Changed" : "Would change"} ${blocks} ${undo ? "divider lines back to HTML" : "HTML lines to divider lines"} in ${documents} documents (${Object.entries(byType).map(([type, n]) => `${type}: ${n}`).join(", ") || "none"}), dataset ${dataset}.`);
if (!apply) console.log("Nothing was changed. Add --apply to change them.");
