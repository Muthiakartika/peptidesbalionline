/**
 * The export rebuilt from a MySQL dump (wordpress-dump.mjs): shapes, the encoding repair, and the rows the real importer
 * writes from it (in-memory PGlite with every migration). A tiny made-up dump; made-up people, codes and IDs only.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildExportFromDump, fixMojibake, phpUnserialize } from "./wordpress-dump.mjs";
import { importWordpress, reconcile } from "./wordpress-import.mjs";

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`);
const table = (name, columns, rows) =>
  `CREATE TABLE \`wp_${name}\` (\n${columns.map((c) => `  \`${c}\` text`).join(",\n")}\n) ENGINE=InnoDB;\n\nINSERT INTO \`wp_${name}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES\n${rows.map((r) => `(${r.map(q).join(", ")})`).join(",\n")};\n`;

/** What a UTF-8 "–" looks like in this dump: "â€“" (Windows-1252 read of its bytes). */
const EN_DASH_MOJIBAKE = "â€“";

const dump = [
  table("users", ["ID", "user_login", "user_pass", "user_nicename", "user_email", "user_url", "user_registered", "user_activation_key", "user_status", "display_name"], [
    [20, "buyer", "x", "buyer", "Buyer@Example.com", "", "2026-11-01 10:00:00", "", 0, "Test Buyer"],
    [21, "boss", "x", "boss", "boss@example.com", "", "2026-10-01 10:00:00", "", 0, "Test Boss"],
  ]),
  table("usermeta", ["umeta_id", "user_id", "meta_key", "meta_value"], [
    [1, 20, "first_name", "Test"], [2, 20, "last_name", "Buyer"], [3, 20, "wp_capabilities", 'a:1:{s:8:"customer";b:1;}'], [4, 20, "billing_first_name", "Test"], [5, 20, "billing_address_1", "Jl. Contoh 1"],
    [6, 20, "billing_city", "Denpasar"], [7, 20, "billing_country", "ID"], [8, 20, "billing_phone", "+6281200000001"], [9, 20, "billing_email", "buyer@example.com"], [10, 20, "billing_phone_country_code", "ID|+62"],
    [11, 20, "default_password_nag", "1"], [12, 20, "session_tokens", "ignored"], [13, 21, "wp_capabilities", 'a:1:{s:13:"administrator";b:1;}'],
  ]),
  table("wc_orders", ["id", "status", "currency", "type", "tax_amount", "total_amount", "customer_id", "billing_email", "date_created_gmt", "date_updated_gmt", "parent_order_id", "payment_method", "payment_method_title", "transaction_id", "ip_address", "user_agent", "customer_note"], [
    [5001, "wc-completed", "IDR", "shop_order", "0", "1895000.00", 20, "buyer@example.com", "2026-11-02 03:00:00", "2026-11-03 03:00:00", 0, "sleeks_wise", "Wise", "", "203.0.113.5", "TestAgent", `Please call${EN_DASH_MOJIBAKE}thanks`],
    [5002, "trash", "IDR", "shop_order", "0", "100000.00", 0, "gone@example.com", "2026-11-02 04:00:00", "2026-11-02 04:00:00", 0, "cod", "COD", "", "", "", ""],
  ]),
  table("wc_order_addresses", ["id", "order_id", "address_type", "first_name", "last_name", "company", "address_1", "address_2", "city", "state", "postcode", "country", "email", "phone"], [
    [1, 5001, "billing", "Test", "", "", "Jl. Contoh 1", "", "Denpasar", "BA", "80111", "ID", "buyer@example.com", "+6281200000001"],
    [2, 5001, "shipping", "Test", "", "", "Jl. Contoh 1", "", "Denpasar", "BA", "80111", "ID", "", ""],
  ]),
  table("wc_order_operational_data", ["id", "order_id", "created_via", "woocommerce_version", "prices_include_tax", "coupon_usages_are_counted", "download_permission_granted", "cart_hash", "new_order_email_sent", "order_key", "order_stock_reduced", "date_paid_gmt", "date_completed_gmt", "shipping_tax_amount", "shipping_total_amount", "discount_tax_amount", "discount_total_amount", "recorded_sales"], [
    [1, 5001, "checkout", "11.2", 0, 1, 1, "h", 1, "wc_order_abc123", 1, "2026-11-02 05:00:00", "2026-11-03 03:00:00", "0", "100000.00", "0", "250000.00", 1],
  ]),
  table("wc_orders_meta", ["id", "order_id", "meta_key", "meta_value"], [
    [1, 5001, "_delivery_day", "2026-11-04"], [2, 5001, "_delivery_time_slot", "09:00-12:00"], [3, 5001, "_billing_phone_country_code", "ID|+62"], [4, 5001, "is_vat_exempt", "no"], [5, 5001, "_wc_order_attribution_source_type", "organic"],
  ]),
  table("woocommerce_order_items", ["order_item_id", "order_item_name", "order_item_type", "order_id"], [
    [901, "Retatrutide - 5 MG", "line_item", 5001], [902, `Buy 3+ Vials ${EN_DASH_MOJIBAKE} 20% Off`, "fee", 5001], [903, "Shipping", "shipping", 5001], [904, "friend-test", "coupon", 5001],
  ]),
  table("woocommerce_order_itemmeta", ["meta_id", "order_item_id", "meta_key", "meta_value"], [
    [1, 901, "_product_id", 4687], [2, 901, "_variation_id", 5613], [3, 901, "_qty", 1], [4, 901, "_line_subtotal", "2045000"], [5, 901, "_line_total", "1795000"], [6, 901, "pa_mg", "5-mg"], [7, 901, "vial-size", "3ml"],
    [8, 902, "_line_total", "0"], [9, 903, "method_id", "free_shipping"], [10, 903, "instance_id", "2"], [11, 903, "cost", "100000.00"], [12, 904, "discount_amount", "250000"],
  ]),
  table("comments", ["comment_ID", "comment_post_ID", "comment_author", "comment_date_gmt", "comment_content", "comment_type"], [
    [7001, 5001, "WooCommerce", "2026-11-02 03:00:05", "Order status changed from Pending payment to On hold.", "order_note"],
    [7002, 5001, "system", "2026-11-03 03:00:00", "Hello customer", "order_note"],
    [7003, 100, "A reader", "2026-11-03 04:00:00", "Nice post", "comment"],
  ]),
  table("commentmeta", ["meta_id", "comment_id", "meta_key", "meta_value"], [[1, 7001, "note_group", "x"], [2, 7002, "is_customer_note", "1"]]),
  table("woocommerce_attribute_taxonomies", ["attribute_id", "attribute_name", "attribute_label"], [[1, "mg", "MG"]]),
  table("terms", ["term_id", "name", "slug"], [[50, "5 MG", "5-mg"]]),
  table("term_taxonomy", ["term_taxonomy_id", "term_id", "taxonomy"], [[50, 50, "pa_mg"]]),
  table("posts", ["ID", "post_title", "post_status", "post_date_gmt", "post_modified_gmt", "post_excerpt", "post_type"], [
    [8001, "FRIEND-TEST", "publish", "2026-10-01 00:00:00", "2026-10-02 00:00:00", "A friend coupon", "shop_coupon"],
    [8002, "About", "publish", "2026-10-01 00:00:00", "2026-10-01 00:00:00", "", "page"],
  ]),
  table("postmeta", ["meta_id", "post_id", "meta_key", "meta_value"], [
    [1, 8001, "discount_type", "fixed_cart"], [2, 8001, "coupon_amount", "250000"], [3, 8001, "individual_use", "yes"], [4, 8001, "usage_limit", "1"], [5, 8001, "usage_limit_per_user", "0"],
    [6, 8001, "expiry_date", "1801165993"], [7, 8001, "minimum_amount", "2500000"], [8, 8001, "customer_email", 'a:1:{i:0;s:17:"Buyer@example.com";}'], [9, 8001, "_used_by", "20"], [10, 8001, "usage_count", "1"],
    [11, 8002, "_wp_page_template", "default"],
  ]),
  table("affiliate_wp_affiliates", ["affiliate_id", "rest_id", "user_id", "rate", "rate_type", "flat_rate_basis", "payment_email", "status", "earnings", "unpaid_earnings", "referrals", "visits", "date_registered"], [
    [1, "", 21, "", "", "", "boss@example.com", "active", "0.00", "0.00", 0, 1, "2026-10-02 00:00:00"],
  ]),
  table("affiliate_wp_referrals", ["referral_id", "affiliate_id", "visit_id", "rest_id", "customer_id", "parent_id", "description", "status", "amount", "currency", "custom", "context", "campaign", "type", "flag", "reference", "products", "payout_id", "date"], []),
  table("affiliate_wp_visits", ["visit_id", "affiliate_id", "referral_id", "rest_id", "url", "referrer", "campaign", "context", "flag", "ip", "date"], [[1, 1, 0, "", "https://example.com/?ref=boss", "", "", "", "", "203.0.113.9", "2026-10-03 00:00:00"]]),
  table("affiliate_wp_customers", ["customer_id", "user_id", "email", "first_name", "last_name", "ip", "date_created"], []),
]
  .join("\n")
  .replace(/INSERT INTO `wp_affiliate_wp_referrals`[^;]*VALUES\n;/, "")
  .replace(/INSERT INTO `wp_affiliate_wp_customers`[^;]*VALUES\n;/, "");

let directory;
let file;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wpdump-"));
  file = join(directory, "dump.sql.gz");
  writeFileSync(file, gzipSync(dump));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("small helpers", () => {
  it("reads PHP serialize() output", () => {
    expect(phpUnserialize('a:1:{s:8:"customer";b:1;}')).toEqual({ customer: true });
    expect(phpUnserialize('a:2:{i:0;i:12;i:1;i:15;}')).toEqual({ 0: 12, 1: 15 });
    // PHP counts bytes: "é" is two, so "é.test" is s:7.
    expect(phpUnserialize('a:1:{i:0;s:7:"é.test";}')).toEqual({ 0: "é.test" });
    expect(() => phpUnserialize("not serialized")).toThrow();
  });

  it("undoes the double encoding and leaves everything else alone", () => {
    expect(fixMojibake("BPCâ€‘157")).toBe("BPC‑157");
    expect(fixMojibake(`Buy 3+ Vials ${EN_DASH_MOJIBAKE} 20% Off`)).toBe("Buy 3+ Vials – 20% Off");
    expect(fixMojibake("6 Ã\u0097 3ml")).toBe("6 × 3ml");
    expect(fixMojibake("plain ascii")).toBe("plain ascii");
    expect(fixMojibake("already fine: é – ’")).toBe("already fine: é – ’");
    expect(fixMojibake("Café")).toBe("Café");
  });
});

describe("the export built from the dump", () => {
  it("has users with their roles and saved addresses, like the REST export", async () => {
    const data = await buildExportFromDump(file);
    expect(data.version).toBe(1);
    expect(data.users.map((u) => [u.id, u.username, u.roles])).toEqual([[20, "buyer", ["customer"]], [21, "boss", ["administrator"]]]);
    const buyer = data.customers.find((c) => c.id === 20);
    expect(buyer).toMatchObject({ first_name: "Test", billing: { address_1: "Jl. Contoh 1", city: "Denpasar", email: "buyer@example.com", phone: "+6281200000001", company: "" } });
    expect(buyer.meta_data).toEqual([{ key: "billing_phone_country_code", value: "ID|+62" }, { key: "default_password_nag", value: "1" }]);
  });

  it("has the orders without the trash, with lines, fees, shipping, coupons, meta and notes", async () => {
    const data = await buildExportFromDump(file);
    expect(data.orders.map((o) => [o.id, o.status])).toEqual([[5001, "completed"]]);
    expect(data.skipped["orders in the trash"]).toBe(1);
    const [order] = data.orders;
    expect(order).toMatchObject({ number: "5001", order_key: "wc_order_abc123", total: "1895000.00", discount_total: "250000.00", shipping_total: "100000.00", created_via: "checkout", customer_id: 20, payment_method: "sleeks_wise", date_paid_gmt: "2026-11-02 05:00:00" });
    expect(order.customer_note).toBe("Please call–thanks");
    expect(order.meta_data.map((m) => m.key)).toEqual(["_delivery_day", "_delivery_time_slot", "_billing_phone_country_code", "_wc_order_attribution_source_type"]);
    expect(order.line_items[0]).toMatchObject({ id: 901, product_id: 4687, variation_id: 5613, quantity: 1, subtotal: "2045000", total: "1795000" });
    // Attributes by their label and term name, other meta as it is.
    expect(order.line_items[0].meta_data).toEqual([
      { key: "pa_mg", value: "5-mg", display_key: "MG", display_value: "5 MG" },
      { key: "vial-size", value: "3ml", display_key: "vial-size", display_value: "3ml" },
    ]);
    expect(order.fee_lines).toMatchObject([{ id: 902, name: "Buy 3+ Vials – 20% Off", total: "0" }]);
    expect(order.shipping_lines).toMatchObject([{ method_id: "free_shipping", instance_id: "2", method_title: "Shipping", total: "100000.00" }]);
    expect(order.coupon_lines).toMatchObject([{ code: "friend-test", discount: "250000" }]);
    // Only order notes (not a reader's comment), the customer flag from the comment meta.
    expect(data.orderNotes[5001].map((n) => [n.id, n.customer_note])).toEqual([[7001, false], [7002, true]]);
  });

  it("has coupons (the legacy expiry key too) and AffiliateWP's rows", async () => {
    const data = await buildExportFromDump(file);
    expect(data.coupons).toHaveLength(1);
    expect(data.coupons[0]).toMatchObject({
      id: 8001, code: "FRIEND-TEST", amount: "250000.00", discount_type: "fixed_cart", status: "publish", individual_use: true, usage_limit: 1, usage_limit_per_user: null,
      date_expires_gmt: "2027-01-28T19:53:13.000Z", minimum_amount: "2500000", email_restrictions: ["Buyer@example.com"], used_by: ["20"], usage_count: 1, description: "A friend coupon",
    });
    expect(data.affiliateWp.affiliates).toHaveLength(1);
    expect(data.affiliateWp.visits).toHaveLength(1);
    expect(data.affiliateWp.referrals).toEqual([]);
  });

  it("says so when the table prefix is wrong", async () => {
    await expect(buildExportFromDump(file, { prefix: "zz_" })).rejects.toThrow(/prefix/);
  });
});

describe("importing the dump with the real importer", () => {
  let pg;
  const db = () => ({ run: (fn) => pg.transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows)), query: async (text, params = []) => (await pg.query(text, params)).rows });

  beforeAll(async () => {
    pg = new PGlite();
    const dir = new URL("../../src/db/migrations/", import.meta.url);
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  }, 60_000);

  it("writes accounts, the order with everything on it, the coupon, and reconciles", async () => {
    const data = await buildExportFromDump(file);
    const catalog = { products: [{ id: 4687, path: "/product/glp-3-5mg/" }], categories: [] };
    await importWordpress(data, db(), { secret: "test-secret", catalog });
    const rows = async (text, params = []) => (await pg.query(text, params)).rows;
    expect(await rows("SELECT email, role, temporary_password FROM users ORDER BY legacy_wp_user_id")).toEqual([
      { email: "buyer@example.com", role: "customer", temporary_password: true },
      { email: "boss@example.com", role: "administrator", temporary_password: false },
    ]);
    const [order] = await rows("SELECT * FROM orders");
    expect(order).toMatchObject({ legacy_wc_order_id: 5001, status: "completed", payment_method: "sleeks_wise", delivery_day: "2026-11-04", created_via: "checkout" });
    expect(String(order.total_minor)).toBe("189500000");
    expect(order.customer_note).toBe("Please call–thanks");
    expect(await rows("SELECT product_name, variant_label, product_path, line_total_minor::text AS t FROM order_items")).toEqual([{ product_name: "Retatrutide - 5 MG", variant_label: "MG: 5 MG, vial-size: 3ml", product_path: "/product/glp-3-5mg/", t: "179500000" }]);
    expect(await rows("SELECT label FROM order_fees")).toEqual([{ label: "Buy 3+ Vials – 20% Off" }]);
    expect(await rows("SELECT code, amount_minor::text AS a FROM coupon_redemptions")).toEqual([{ code: "friend-test", a: "25000000" }]);
    expect(await rows("SELECT is_customer_note FROM order_notes ORDER BY legacy_wc_note_id")).toEqual([{ is_customer_note: false }, { is_customer_note: true }]);
    expect(await rows("SELECT code, expires_at FROM coupons")).toMatchObject([{ code: "friend-test" }]);

    // The importer's own reconciliation: every line "ok", and running it a second time changes nothing.
    const report = await reconcile(data, db().query);
    expect(report.filter((r) => !r.ok)).toEqual([]);
    await importWordpress(data, db(), { secret: "test-secret", catalog });
    expect((await rows("SELECT count(*)::int AS n FROM orders"))[0].n).toBe(1);
    expect((await rows("SELECT count(*)::int AS n FROM order_items"))[0].n).toBe(1);
  });
});
