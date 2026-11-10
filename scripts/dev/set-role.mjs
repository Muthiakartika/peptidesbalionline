/**
 * Gives an account a role (WordPress's roles: customer, shop_manager, administrator):
 *
 *   node scripts/dev/set-role.mjs <e-mail> administrator
 *
 * Staff (administrator, shop_manager) see the order screens under /admin/orders/. Works on the database in
 * DATABASE_URL (Neon) or, when it is empty, on the local one in .data/pglite: stop the site first, only one
 * program can open that folder.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const require = createRequire(import.meta.url);

const [email, role] = process.argv.slice(2);
const ROLES = ["customer", "shop_manager", "administrator"];
if (!email || !ROLES.includes(role)) {
  console.error(`Usage: node scripts/dev/set-role.mjs <e-mail> <${ROLES.join("|")}>`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
let rows;
if (url) {
  const postgres = require("postgres");
  const sql = postgres(url, { prepare: false });
  rows = await sql`update users set role = ${role} where lower(email) = lower(${email}) returning email`;
  await sql.end();
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(".data/pglite");
  rows = (await db.query("update users set role = $1 where lower(email) = lower($2) returning email", [role, email])).rows;
  await db.close();
}
console.log(rows.length ? `${email} is now ${role}.` : `No account with the e-mail ${email}.`);
