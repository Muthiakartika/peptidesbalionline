#!/usr/bin/env node
// Copies every picture the site uses from WordPress (https://peptidesbali.online/wp-content/uploads/…)
// to the Cloudflare R2 bucket, under the same path (wp-content/uploads/2026/10/x.png), so switching
// NEXT_PUBLIC_MEDIA_BASE_URL to the bucket changes nothing else. See docs/setup/r2.md.
//
//   node scripts/media/copy-uploads-to-r2.mjs --dry-run   # list what would be copied
//   node scripts/media/copy-uploads-to-r2.mjs             # copy (files already in the bucket are skipped)
//   node scripts/media/copy-uploads-to-r2.mjs --check     # check every file answers on R2_PUBLIC_URL
//
// The addresses come from the copies of the live site in this project (src/content/, the Elementor
// CSS in public/legacy/ and src/styles/), and from the Sanity dataset in NEXT_PUBLIC_SANITY_DATASET
// (pictures editors picked there). Only reads from WordPress (plain GETs of public files, 3 at a time).
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (and R2_PUBLIC_URL for
// --check) in .env.local; nothing secret is printed. A list of what failed goes to .data/media/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AwsClient } from "aws4fetch";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
const args = new Set(process.argv.slice(2));
const LIVE = "https://peptidesbali.online";
const UPLOADS = /https?:\/\/(?:www\.)?peptidesbali\.online(\/wp-content\/uploads\/[^\s"'()<>,\\]+?\.(?:jpe?g|png|gif|webp|avif|svg|ico|pdf|mp4|webm))(?=[\s"'()<>,\\?#]|$)/gi;

/** Every /wp-content/uploads/… path mentioned in the project's copies of the live site. */
export function findUploadPaths(texts) {
  const paths = new Set();
  for (const text of texts) for (const match of text.matchAll(UPLOADS)) paths.add(decodeURI(match[1]).replace(/&amp;/g, "&"));
  return [...paths].sort();
}

function filesUnder(dir, test) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full, test) : test(entry.name) ? [full] : [];
  });
}

async function sanityTexts() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  if (!projectId || !dataset) return [];
  const url = `https://${projectId}.api.sanity.io/v2026-11-01/data/query/${dataset}?query=${encodeURIComponent('*[_type in ["page", "sharedSection", "popup", "post", "product"]]')}`;
  const response = await fetch(url);
  return response.ok ? [await response.text()] : [];
}

async function main() {
  const sources = [
    ...filesUnder(path.join(root, "src/content"), (n) => /\.(json|ts)$/.test(n)),
    ...filesUnder(path.join(root, "public/legacy"), (n) => n.endsWith(".css")),
    ...filesUnder(path.join(root, "src/styles"), (n) => n.endsWith(".css")),
  ];
  const texts = [...sources.map((f) => fs.readFileSync(f, "utf8")), ...(await sanityTexts())];
  const paths = findUploadPaths(texts);
  console.log(`${paths.length} files under /wp-content/uploads/ are used by the site.`);
  if (args.has("--dry-run")) {
    for (const p of paths.slice(0, 20)) console.log("  " + p);
    if (paths.length > 20) console.log(`  … and ${paths.length - 20} more`);
    return;
  }

  const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket, R2_PUBLIC_URL: publicUrl } = process.env;
  if (args.has("--check")) {
    if (!publicUrl) throw new Error("R2_PUBLIC_URL is not set in .env.local");
    const missing = [];
    await inBatches(paths, 6, async (p) => {
      const response = await fetch(`${publicUrl.replace(/\/+$/, "")}${p}`, { method: "HEAD" });
      if (!response.ok) missing.push(`${response.status} ${p}`);
    });
    report(missing, "not answering on R2_PUBLIC_URL");
    return;
  }
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must be set in .env.local");
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const objectUrl = (p) => `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${p.slice(1).split("/").map(encodeURIComponent).join("/")}`;

  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  const failed = [];
  await inBatches(paths, 3, async (p) => {
    const head = await r2.fetch(objectUrl(p), { method: "HEAD" });
    if (head.ok) {
      skipped++;
      return;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const source = await fetch(`${LIVE}${encodeURI(p)}`, { headers: { "User-Agent": "peptidesbali-media-copy/1.0" } });
        if (source.status === 404) {
          failed.push(`404 on WordPress ${p}`);
          return;
        }
        if (!source.ok) throw new Error(`WordPress ${source.status}`);
        const body = new Uint8Array(await source.arrayBuffer());
        const put = await r2.fetch(objectUrl(p), {
          method: "PUT",
          body,
          headers: { "Content-Type": source.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
        });
        if (!put.ok) throw new Error(`R2 ${put.status}`);
        copied++;
        bytes += body.length;
        return;
      } catch (error) {
        if (attempt === 3) failed.push(`${error.message} ${p}`);
        else await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  });
  console.log(`\nCopied ${copied} (${(bytes / 1e6).toFixed(1)} MB), ${skipped} already in the bucket.`);
  report(failed, "not copied");
}

async function inBatches(items, concurrency, work) {
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await work(item);
        done++;
        if (done % 50 === 0 || done === items.length) process.stdout.write(`\r${done}/${items.length}`);
      }
    }),
  );
}

function report(problems, what) {
  if (!problems.length) {
    console.log(`\nEvery file is fine.`);
    return;
  }
  const out = path.join(root, ".data/media");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `problems-${new Date().toISOString().slice(0, 10)}.txt`);
  fs.writeFileSync(file, problems.join("\n") + "\n");
  console.log(`\n${problems.length} ${what}: see ${path.relative(root, file)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
