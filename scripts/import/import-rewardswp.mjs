/**
 * Imports RewardsWP Pro's members, points and referrals from the owner's MySQL dump into the rewards tables:
 *
 *   node scripts/import/import-rewardswp.mjs <dump.sql | dump.sql.gz>
 *
 * The dump holds every customer's personal data: keep it OUTSIDE this folder (the script refuses a file inside
 * it) and delete it when it is no longer needed. Run the main import (import-wordpress.mjs) first, so the
 * accounts and orders exist, and `npm run db:migrate` (migration 0010). Local database: stop the site first.
 * Safe to run again. Prints counts only. What it does with each kind of row: scripts/import/rewardswp-import.mjs.
 */
import { existsSync } from "node:fs";

import { openDatabase, outsideProject } from "./database.mjs";
import { readMysqlTables } from "./mysqldump.mjs";
import { importRewardsWp, REWARDSWP_TABLES } from "./rewardswp-import.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: node scripts/import/import-rewardswp.mjs <dump.sql | dump.sql.gz>");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}
if (!outsideProject(file)) {
  console.error("The dump holds personal data: move it outside this project folder first (e.g. Downloads).");
  process.exit(1);
}

const tables = await readMysqlTables(file, REWARDSWP_TABLES);
if (!tables.wp_rewardswp_members.columns.length) {
  console.error("This dump has no wp_rewardswp_members table: is it the right database, and is the table prefix wp_?");
  process.exit(1);
}

const db = await openDatabase();
try {
  const s = await importRewardsWp(tables, db);
  console.log(`RewardsWP into ${db.where}:`);
  console.log(`  members      in file ${s.members.inFile} | imported ${s.members.imported} | already there ${s.members.alreadyThere} | no account here ${s.members.noAccount}`);
  console.log(`  points       in file ${s.points.inFile} | imported ${s.points.imported} | already there ${s.points.alreadyThere} | member not imported ${s.points.noMember}`);
  console.log(`               pending purchases: credited now ${s.points.pendingCreditedNow} | waiting for their order ${s.points.pendingWaiting} | order not found here ${s.points.orderNotFound}`);
  console.log(`  referrals    in file ${s.referrals.inFile} | imported ${s.referrals.imported} | already there ${s.referrals.alreadyThere} | member not imported ${s.referrals.noMember} | coupons marked ${s.referrals.couponsLinked}`);
  console.log("  reconciliation (RewardsWP's balance = its approved points = credits imported):");
  for (const line of s.reconciliation) console.log(`    member #${line.memberId}: balance ${line.legacyBalance}, approved ${line.approvedPoints}, imported ${line.importedCredits} ${line.ok ? "ok" : "MISMATCH"}`);
  console.log("Delete the dump when you no longer need it.");
} finally {
  await db.close();
}
