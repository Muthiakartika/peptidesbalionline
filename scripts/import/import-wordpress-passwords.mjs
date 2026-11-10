/**
 * Imports the WordPress password hashes, so imported customers keep their old password (Q-07):
 *
 *   node scripts/import/import-wordpress-passwords.mjs <users-export.csv|.json>
 *   node scripts/import/import-wordpress-passwords.mjs --forget-all     (delete every old hash still waiting)
 *
 * The export comes from the owner's database (phpMyAdmin or the host's tool): the users table (wp_users, or
 * <prefix>_users), at least the columns ID and user_pass. It holds password hashes: keep it OUTSIDE this
 * folder and delete it after the import. Run the main import (import-wordpress.mjs) first, so the accounts
 * exist, and `npm run db:migrate` (migration 0007). Local database: stop the site first.
 * Prints counts only.
 */
import { existsSync, readFileSync } from "node:fs";

import { openDatabase, outsideProject } from "./database.mjs";
import { importPasswords, parsePasswordExport } from "./wordpress-passwords.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const args = process.argv.slice(2);
const forgetAll = args.includes("--forget-all");
const file = args.find((a) => !a.startsWith("--"));
if (!forgetAll && !file) {
  console.error("Usage: node scripts/import/import-wordpress-passwords.mjs <users-export.csv|.json>  (or --forget-all)");
  process.exit(1);
}
if (file && !outsideProject(file)) {
  console.error("The export holds password hashes: move it outside this project folder first (e.g. Downloads).");
  process.exit(1);
}

const db = await openDatabase();
try {
  if (forgetAll) {
    const rows = await db.query("DELETE FROM legacy_passwords RETURNING user_id");
    console.log(`Deleted ${rows.length} old WordPress password hash(es) from ${db.where}. Those customers use "Lost your password?" now.`);
  } else {
    const rows = parsePasswordExport(readFileSync(file, "utf8"));
    if (!rows.length) throw new Error("No rows with an ID and a user_pass were found in the file. Export the columns ID and user_pass of the users table.");
    const summary = await importPasswords(rows, db);
    console.log(`Old WordPress passwords into ${db.where}:`);
    console.log(`  rows in the file                      ${summary.inFile}`);
    console.log(`  imported (old password works)         ${summary.imported}  ${JSON.stringify(summary.formats)}`);
    console.log(`  skipped: password already set here    ${summary.alreadyHasPasswordHere}`);
    console.log(`  skipped: no imported account          ${summary.noAccount}`);
    console.log(`  skipped: hash format not supported    ${summary.unsupported}`);
    const [{ waiting }] = await db.query("SELECT count(*)::int AS waiting FROM legacy_passwords");
    console.log(`Accounts waiting for their first login with the old password: ${waiting}. Delete the export file now.`);
  }
} finally {
  await db.close();
}
