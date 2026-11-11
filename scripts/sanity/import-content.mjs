#!/usr/bin/env node
// Sends the pages, shared sections, popups and Site settings (top bar, menu, footer, notices) copied
// from the live site (src/content/) to a Sanity dataset, converted to editable sections and widgets
// (scripts/sanity/lib/).
//
//   node scripts/sanity/import-content.mjs --dataset staging            # adds what isn't there yet
//   node scripts/sanity/import-content.mjs --dataset staging --overwrite  # replaces (loses edits!)
//   node scripts/sanity/import-content.mjs --dry-run                     # only counts, sends nothing
//   node scripts/sanity/import-content.mjs --dataset staging --only post-a,post-b  # just these ids
//
// --only limits a run to the listed document ids (e.g. post-<slug>): new posts from WordPress can be
// added, or one changed post replaced (with --overwrite), without touching anything else (a full run
// would also re-create documents deleted on purpose, such as products removed in the store admin).
//
// Safe by default: a document that already exists is left alone, so edits made in the Studio
// survive a second run. --overwrite replaces them with the copy of the live site. The production
// dataset also needs --yes. Reads NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN from
// .env.local (the token is never printed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

import { buildContent, convertSiteChrome } from "./lib/documents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));

const content = buildContent(root);
const built = [await convertSiteChrome(root), ...content.shared, ...content.popups, ...content.pages, ...content.posts, ...content.products];
const only = option("only")?.split(",").map((id) => id.trim()).filter(Boolean);
const unknown = only?.filter((id) => !built.some((doc) => doc._id === id)) ?? [];
if (unknown.length) throw new Error(`--only: no such document in the copy of the live site: ${unknown.join(", ")}`);
const documents = only ? built.filter((doc) => only.includes(doc._id)) : built;
const bytes = (doc) => Buffer.byteLength(JSON.stringify(doc));
if (only) console.log(`--only: ${documents.length} of ${built.length} documents.`);
console.log(`Built Site settings, ${content.pages.length} pages, ${content.shared.length} shared sections, ${content.popups.length} popups, ${content.posts.length} blog posts, ${content.products.length} products (${(documents.reduce((n, d) => n + bytes(d), 0) / 1e6).toFixed(1)} MB).`);

if (flag("dry-run")) {
  const out = path.join(root, ".data/sanity");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "content.ndjson"), documents.map((d) => JSON.stringify(d)).join("\n"));
  console.log(`Dry run: nothing sent. Documents written to ${path.relative(root, out)}/content.ndjson`);
  process.exit(0);
}

const dataset = option("dataset");
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const token = process.env.SANITY_API_WRITE_TOKEN;
if (!dataset) throw new Error("Say which dataset: --dataset staging");
if (dataset === "production" && !flag("yes")) throw new Error("The production dataset also needs --yes");
if (!projectId || !token) throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN must be set in .env.local");

const client = createClient({ projectId, dataset, token, apiVersion: "2026-11-01", useCdn: false });
const overwrite = flag("overwrite");
const existing = new Set(await client.fetch(`*[_id in $ids]._id`, { ids: documents.map((d) => d._id) }));

// Small transactions (Sanity accepts a few MB per request).
const LIMIT = 3_000_000;
let batch = [];
let size = 0;
let sent = 0;
let skipped = 0;
const flush = async () => {
  if (!batch.length) return;
  const transaction = client.transaction();
  for (const doc of batch) transaction[overwrite ? "createOrReplace" : "createIfNotExists"](doc);
  await transaction.commit({ visibility: "async" });
  sent += batch.length;
  process.stdout.write(`\r${sent}/${documents.length} sent`);
  batch = [];
  size = 0;
};
for (const doc of documents) {
  if (existing.has(doc._id) && !overwrite) {
    skipped++;
    continue;
  }
  if (size + bytes(doc) > LIMIT) await flush();
  batch.push(doc);
  size += bytes(doc);
}
await flush();
console.log(`\nDone: ${sent} sent to "${dataset}", ${skipped} already there (left as they are${skipped ? "; --overwrite replaces them" : ""}).`);
