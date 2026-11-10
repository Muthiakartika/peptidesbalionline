/**
 * Visual regression check: compares screenshots of the Next.js rebuild against the reference
 * screenshots of the live WordPress site (docs/audit/visual-reference/screenshots/).
 *
 * 1. Capture the rebuild with the same script and settings as the references:
 *      CAPTURE_BASE_URL=http://localhost:3000 OUT_DIR=test-results/screenshots npm run audit:screenshots
 * 2. Compare:
 *      npm run verify:visual            (all templates that have a new capture)
 *      ONLY=home,shop npm run verify:visual
 *
 * Output: test-results/visual-diff/report.md plus a red-highlighted diff image per comparison.
 * The overlapping height is compared pixel by pixel; a page that is taller or shorter than the
 * reference is reported as a height difference too (usually a sign of a spacing mistake).
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REFERENCE_DIR = process.env.REFERENCE_DIR ?? path.join(ROOT, "docs", "audit", "visual-reference", "screenshots");
const CANDIDATE_DIR = process.env.CANDIDATE_DIR ?? path.join(ROOT, "test-results", "screenshots");
const OUT_DIR = path.join(ROOT, "test-results", "visual-diff");
const posix = (p) => p.split(path.sep).join("/");
// A template "passes" when at most this share of pixels differ (anti-aliasing, fonts, live widgets).
const MAX_MISMATCH_PERCENT = Number(process.env.MAX_MISMATCH_PERCENT ?? 2);

// Images are never resized: the live site overflows sideways by ~10px (its full-page captures are
// 1450px wide at a 1440px viewport), so both images are cropped to the width and height they share.
async function readRgba(file, width, height) {
  const meta = await sharp(file).metadata();
  const image = sharp(file)
    .extract({ left: 0, top: 0, width: Math.min(width ?? meta.width, meta.width), height: Math.min(height ?? meta.height, meta.height) })
    .ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const dimensions = async (file) => {
  const { width, height } = await sharp(file).metadata();
  return { width, height };
};

async function compare(template, file) {
  const referenceFile = path.join(REFERENCE_DIR, template, file);
  const candidateFile = path.join(CANDIDATE_DIR, template, file);
  if (!existsSync(candidateFile)) return { template, file, status: "missing" };

  const refSize = await dimensions(referenceFile);
  const candSize = await dimensions(candidateFile);
  const width = Math.min(refSize.width, candSize.width);
  const height = Math.min(refSize.height, candSize.height);
  const reference = await readRgba(referenceFile, width, height);
  const candidate = await readRgba(candidateFile, width, height);
  const diff = Buffer.alloc(width * height * 4);
  const mismatched = pixelmatch(reference.data, candidate.data, diff, width, height, { threshold: 0.1 });
  const mismatchPercent = (mismatched / (width * height)) * 100;
  const heightDelta = candSize.height - refSize.height;

  const diffFile = path.join(OUT_DIR, template, file.replace(/\.jpg$/, ".diff.png"));
  await mkdir(path.dirname(diffFile), { recursive: true });
  await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(diffFile);

  const pass = mismatchPercent <= MAX_MISMATCH_PERCENT && Math.abs(heightDelta) <= 2;
  return { template, file, status: pass ? "pass" : "fail", mismatchPercent, heightDelta, diffFile: posix(path.relative(OUT_DIR, diffFile)) };
}

async function main() {
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((s) => s.trim())) : null;
  const templates = (await readdir(REFERENCE_DIR)).filter((t) => !only || only.has(t));
  const results = [];
  for (const template of templates) {
    for (const file of (await readdir(path.join(REFERENCE_DIR, template))).filter((f) => f.endsWith(".jpg"))) {
      results.push(await compare(template, file));
    }
  }

  const compared = results.filter((r) => r.status !== "missing");
  const failed = compared.filter((r) => r.status === "fail");
  const lines = [
    "# Visual comparison report",
    "",
    `Reference: \`${posix(path.relative(ROOT, REFERENCE_DIR))}\` · Candidate: \`${posix(path.relative(ROOT, CANDIDATE_DIR))}\` · Pass if ≤ ${MAX_MISMATCH_PERCENT}% pixels differ and height within 2px`,
    "",
    `**${compared.length - failed.length} passed, ${failed.length} failed, ${results.length - compared.length} not captured yet.**`,
    "",
    "| Template | Viewport | Result | Pixels different | Height difference | Diff image |",
    "|---|---|---|---|---|---|",
    ...compared.map(
      (r) =>
        `| ${r.template} | ${r.file.replace(".jpg", "")} | ${r.status === "pass" ? "✅" : "❌"} | ${r.mismatchPercent.toFixed(2)}% | ${r.heightDelta > 0 ? "+" : ""}${r.heightDelta}px | ${r.diffFile} |`,
    ),
    "",
  ];
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "report.md"), lines.join("\n"), "utf8");
  console.log(`${compared.length - failed.length} passed, ${failed.length} failed, ${results.length - compared.length} not captured yet`);
  console.log(`Report: ${posix(path.relative(ROOT, path.join(OUT_DIR, "report.md")))}`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main();
