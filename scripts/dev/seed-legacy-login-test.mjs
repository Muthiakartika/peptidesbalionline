/**
 * A made-up "imported from WordPress" account for trying the old-password login on this computer: no password
 * on this site, only a WordPress hash (from src/lib/auth/fixtures/wordpress-hashes.json, made with PHP the
 * WordPress way). Its password is that fixture's first test password.
 *
 *   node scripts/dev/seed-legacy-login-test.mjs            add it  (legacy.test@example.com)
 *   node scripts/dev/seed-legacy-login-test.mjs --remove   take it out again
 *
 * Local database only (refuses DATABASE_URL); stop the site first.
 */
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (process.env.DATABASE_URL) {
  console.error("DATABASE_URL is set: this test account goes into the local database only.");
  process.exit(1);
}
const { PGlite } = await import("@electric-sql/pglite");
const db = new PGlite(".data/pglite");
const id = "legacy-login-test";
if (process.argv.includes("--remove")) {
  await db.query("DELETE FROM users WHERE id = $1", [id]);
  console.log("Removed the legacy login test account.");
} else {
  const fixture = JSON.parse(readFileSync("src/lib/auth/fixtures/wordpress-hashes.json", "utf8"));
  // WordPress user ID 990001 doesn't exist on live.
  await db.query(
    `INSERT INTO users (id, name, email, username, display_username, legacy_wp_user_id, role) VALUES ($1, 'Legacy Test', 'legacy.test@example.com', 'legacy.test', 'legacy.test', 990001, 'customer')
     ON CONFLICT (id) DO NOTHING`,
    [id],
  );
  await db.query("INSERT INTO legacy_passwords (user_id, hash) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET hash = excluded.hash", [id, fixture.vectors[0].wpUntrimmed]);
  console.log("Legacy login test account ready: legacy.test@example.com (password: the fixture's first test password).");
}
await db.close();
