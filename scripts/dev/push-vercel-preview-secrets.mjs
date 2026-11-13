/**
 * Sends the seven secret settings the Vercel preview needs to the Vercel project "peptidesbalionline"
 * (environment Preview only, stored as Sensitive): six copied from .env.local, plus a fresh random
 * BETTER_AUTH_SECRET for staging. The owner runs it:
 *
 *   node scripts/dev/push-vercel-preview-secrets.mjs           send them (again: overwrites)
 *   node scripts/dev/push-vercel-preview-secrets.mjs --check   only say which ones are in .env.local
 *
 * It never prints a value; each one goes to the Vercel CLI through stdin, not the command line.
 * Needs the Vercel CLI logged in to the team "algosbizs-projects".
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const PROJECT = "peptidesbalionline";
const SCOPE = "algosbizs-projects";
// Copied from .env.local.
const KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "SANITY_API_WRITE_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
// NOT copied: every environment gets its own login-cookie secret (see .env.example), so Preview gets a
// fresh random one made here (it never leaves this script except to Vercel). Running the script again
// makes a new one, which logs everybody out of staging.
const GENERATED = ["BETTER_AUTH_SECRET"];
const ALL = [...KEYS, ...GENERATED];

const env = parseEnv(readFileSync(".env.local", "utf8"));
const missing = KEYS.filter((key) => !env[key]);
if (missing.length) {
  console.error(`Empty or missing in .env.local: ${missing.join(", ")}. Nothing was sent.`);
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(
    `All ${KEYS.length} are in .env.local: ${KEYS.join(", ")}. ${GENERATED.join(", ")} will be generated fresh. Nothing was sent (--check).`,
  );
  process.exit(0);
}
for (const key of GENERATED) env[key] = randomBytes(32).toString("base64");

let failed = 0;
for (const key of ALL) {
  const args = ["env", "add", key, "--environment", "preview", "--sensitive", "--force", "--yes", "--non-interactive"];
  args.push("--project", PROJECT, "--scope", SCOPE);
  // shell: Windows starts the CLI through vercel.cmd; the arguments are fixed, the value only goes through stdin.
  const run = spawnSync("vercel", args, { input: env[key], encoding: "utf8", shell: true });
  if (run.status === 0) {
    console.log(`${key}: saved (Preview, Sensitive)${GENERATED.includes(key) ? " - freshly generated" : ""}`);
  } else {
    failed++;
    const reason = `${run.stderr ?? ""}${run.stdout ?? ""}`.split(env[key]).join("<hidden>").trim().split("\n").slice(-3).join(" ");
    console.error(`${key}: NOT saved (${reason || `exit ${run.status}`})`);
  }
}
console.log(failed ? `${failed} not saved, see above.` : `Done: ${ALL.length} secrets are on Vercel (Preview). Tell Claude to deploy.`);
process.exit(failed ? 1 : 0);
