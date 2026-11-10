/**
 * Two made-up coupons for trying the cart and checkout on this computer, so no real (imported) code has to
 * be typed:
 *
 *   node scripts/dev/seed-test-coupons.mjs            add them
 *   node scripts/dev/seed-test-coupons.mjs --remove   take them out again (their order lines keep the code)
 *
 *   local-test-5       5%, minimum Rp 800,000, once per customer, individual use (like the welcome coupon)
 *   local-test-fixed   Rp 250,000 off the cart, minimum Rp 2,500,000 (like the refer-a-friend coupon)
 *
 * Local database only (it refuses DATABASE_URL): stop the site first, only one program can open the folder.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (process.env.DATABASE_URL) {
  console.error("DATABASE_URL is set: test coupons go into the local database only.");
  process.exit(1);
}

const { PGlite } = await import("@electric-sql/pglite");
const db = new PGlite(".data/pglite");
const codes = ["local-test-5", "local-test-fixed"];
if (process.argv.includes("--remove")) {
  const { rows } = await db.query("DELETE FROM coupons WHERE code = ANY($1) AND legacy_wc_coupon_id IS NULL RETURNING code", [codes]);
  console.log(`Removed ${rows.length} test coupon(s).`);
} else {
  const note = "LOCAL TEST COUPON, not on the live shop (scripts/dev/seed-test-coupons.mjs)";
  await db.query(
    `INSERT INTO coupons (code, type, amount, description, minimum_amount_minor, usage_limit_per_user, individual_use)
     VALUES ('local-test-5', 'percent', '5.00', $1, 80000000, 1, true), ('local-test-fixed', 'fixed_cart', '250000.00', $1, 250000000, NULL, false)
     ON CONFLICT DO NOTHING`,
    [note],
  );
  console.log("Test coupons ready: local-test-5, local-test-fixed.");
}
await db.close();
