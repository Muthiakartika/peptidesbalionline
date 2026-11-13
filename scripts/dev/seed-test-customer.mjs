/**
 * Creates a test customer to try My Account with, on a site running on THIS computer (never on a live site):
 *
 *   node scripts/dev/seed-test-customer.mjs                  (the dev server on http://localhost:3000)
 *   SITE_URL=http://localhost:3005 node scripts/dev/seed-test-customer.mjs
 *
 * It signs up through the site's own Better Auth endpoint (/api/auth/sign-up/email), so the account is stored like
 * any other, in whichever database that site uses (Neon, or .data/pglite while DATABASE_URL is empty). The
 * password is made up at random and written to .data/test-customer-login.txt (a folder git ignores): it is never
 * printed, and it is not in this file, because a site on Neon can also be reached from the internet. The script then
 * checks that the login works. Running it again keeps the account and its password. Delete the account when done
 * (Neon: DELETE FROM users WHERE email = 'local.tester@example.com').
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const EMAIL = "local.tester@example.com";
const USERNAME = "local.tester";
const LOGIN_FILE = ".data/test-customer-login.txt";

const base = process.env.SITE_URL ?? "http://localhost:3000";
const host = new URL(base).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !host.endsWith(".localhost")) {
  console.error(`Refusing to create a test account on ${base}: local sites only.`);
  process.exit(1);
}
// Better Auth only answers requests from its own address (NEXT_PUBLIC_SITE_URL in .env.local, e.g. :3005 while the dev server is on :3000).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const origin = process.env.AUTH_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? base;
const post = (path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });

const saved = existsSync(LOGIN_FILE) ? /^password: (.+)$/m.exec(readFileSync(LOGIN_FILE, "utf8"))?.[1] : null;
const password = saved ?? `${randomBytes(15).toString("base64url")}!9a`;

const created = await post("/api/auth/sign-up/email", { email: EMAIL, username: USERNAME, name: USERNAME, password });
if (created.status === 200) {
  mkdirSync(".data", { recursive: true });
  writeFileSync(LOGIN_FILE, `Test customer for ${base}\nemail: ${EMAIL}\nusername: ${USERNAME}\npassword: ${password}\n`);
  console.log(`Created ${EMAIL} on ${base}. Login details: ${LOGIN_FILE}`);
} else {
  console.log(`Sign-up answered ${created.status} (${(await created.text()).slice(0, 120)}): the account may exist already.`);
}
const check = await post("/api/auth/sign-in/email", { email: EMAIL, password });
console.log(check.status === 200 ? "Login check: works." : `Login check: answered ${check.status}; the saved password doesn't match the account.`);
