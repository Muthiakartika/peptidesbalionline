/**
 * The WordPress import, on made-up data shaped like the live export (field names and formats as read on
 * 7 Nov 2026; every value here is invented: example.com e-mails, documentation IP ranges).
 * The end-to-end tests run every migration on an in-memory PGlite, so they test the real tables.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { importWordpress, reconcile } from "./wordpress-import.mjs";
import { commissionEntries, countExport, decimalToMinor, htmlToText, mapOrder, utcDate, wordpressRole } from "./wordpress-mapping.mjs";

const SECRET = "test-secret-for-ip-hashes";
const catalog = { products: [{ id: 100, path: "/product/test-pen/" }, { id: 101, path: "/product/test-vial/" }], categories: [{ id: 15, slug: "vial" }] };

const order = (id, extra) => ({
  id,
  number: String(id),
  order_key: `wc_order_test${id}`,
  currency: "IDR",
  date_created_gmt: "2026-10-01T10:00:00",
  date_modified_gmt: "2026-10-02T10:00:00",
  date_paid_gmt: null,
  date_completed_gmt: null,
  discount_total: "0.00",
  shipping_total: "0.00",
  total_tax: "0.00",
  customer_id: 0,
  billing: { first_name: "Guest", last_name: "", company: "", address_1: "Jl. Test 1", address_2: "", city: "Canggu", state: "BA", postcode: "80351", country: "ID", email: "Guest@Example.com", phone: "+6281200000000" },
  shipping: { first_name: "Guest", last_name: "", company: "", address_1: "Jl. Test 1", address_2: "", city: "Canggu", state: "BA", postcode: "80351", country: "ID", phone: "" },
  payment_method: "sleeks_wise",
  payment_method_title: "Wise",
  transaction_id: "",
  customer_ip_address: "203.0.113.7",
  customer_user_agent: "Test agent",
  created_via: "checkout",
  customer_note: "",
  meta_data: [],
  line_items: [],
  fee_lines: [],
  shipping_lines: [{ id: 1, method_id: "free_shipping", instance_id: 2, method_title: "Free shipping", total: "0.00" }],
  coupon_lines: [],
  refunds: [],
  ...extra,
});

const exportData = () => ({
  version: 1,
  source: "https://example.com",
  exportedAt: "2026-11-07T00:00:00.000Z",
  liveTotals: { users: 3, orders: 3, coupons: 1, ordersWithNotesFetched: 3 },
  skipped: { "orders in the trash": 2 },
  users: [
    { id: 1, username: "Owner", name: "Shop Owner", first_name: "Shop", last_name: "Owner", email: "owner@example.com", url: "", roles: ["administrator"], registered_date: "2025-01-01T00:00:00+00:00" },
    { id: 20, username: "test.buyer", name: "Test Buyer", first_name: "Test", last_name: "Buyer", email: "Buyer@Example.com", url: "", roles: ["customer"], registered_date: "2026-09-01T00:00:00+00:00" },
    { id: 21, username: "reader", name: "Reader", first_name: "", last_name: "", email: "reader@example.com", url: "https://reader.example.com", roles: ["subscriber"], registered_date: "2026-09-02T00:00:00+00:00" },
  ],
  customers: [
    { id: 1, email: "owner@example.com", role: "administrator", username: "Owner", billing: {}, shipping: {}, meta_data: [] },
    {
      id: 20,
      email: "buyer@example.com",
      role: "customer",
      username: "test.buyer",
      billing: { first_name: "Test Buyer", last_name: "", address_1: "Jl. Contoh 3", city: "Ubud", state: "BA", postcode: "80571", country: "ID", email: "buyer@example.com", phone: "+6281233334444" },
      shipping: { first_name: "Test Buyer", last_name: "", address_1: "Jl. Contoh 3", city: "Ubud", state: "BA", postcode: "80571", country: "ID", phone: "" },
      meta_data: [
        { key: "billing_phone_country_code", value: "ID|+62" },
        { key: "default_password_nag", value: "1" },
      ],
    },
    { id: 21, email: "reader@example.com", role: "subscriber", username: "reader", billing: { country: "ID" }, shipping: {}, meta_data: [{ key: "default_password_nag", value: "" }] },
  ],
  orders: [
    order(7328, {
      status: "completed",
      customer_id: 20,
      date_paid_gmt: "2026-10-01T11:00:00",
      date_completed_gmt: "2026-10-03T09:00:00",
      discount_total: "130000.00",
      total: "1228500.00",
      billing: { first_name: "Test Buyer", last_name: "", company: "", address_1: "Jl. Contoh 3", address_2: "", city: "Ubud", state: "BA", postcode: "80571", country: "ID", email: "buyer@example.com", phone: "+6281233334444" },
      meta_data: [
        { key: "_delivery_day", value: "2026-10-02" },
        { key: "_delivery_time_slot", value: "09:00-12:00" },
        { key: "_atlas_delivery_latitude", value: "-8.5" },
        { key: "_atlas_delivery_longitude", value: "115.2" },
        { key: "_atlas_google_formatted_address", value: "Jl. Contoh 3, Ubud" },
        { key: "_billing_phone_country_code", value: "ID|+62" },
        { key: "_wc_order_attribution_source_type", value: "typein" },
        { key: "_wc_order_attribution_utm_source", value: "(direct)" },
      ],
      line_items: [{ id: 11, name: "Test Pen", product_id: 100, variation_id: 1001, quantity: 1, subtotal: "1300000.00", total: "1170000.00", meta_data: [{ key: "pa_mg", value: "10-mg", display_key: "MG", display_value: "10 MG" }, { key: "_reduced_stock", value: "1" }] }],
      fee_lines: [{ id: 12, name: "5% Payment Adjustment", total: "58500.00" }],
      coupon_lines: [{ id: 13, code: "TestCoupon", discount: "130000.00" }],
    }),
    order(7400, {
      status: "cancelled",
      payment_method: "nowpayments_gateway",
      payment_method_title: "Crypto",
      transaction_id: "5551234",
      meta_data: [{ key: "_nowpayments_payment_id", value: "5551234" }],
      shipping_total: "100000.00",
      shipping_lines: [{ id: 2, method_id: "flat_rate", instance_id: 1, method_title: "Shipping", total: "100000.00" }],
      line_items: [{ id: 21, name: "Test Vial", product_id: 101, variation_id: 0, quantity: 2, subtotal: "200000.00", total: "200000.00", meta_data: [] }],
      fee_lines: [{ id: 22, name: "Crypto discount (5%)", total: "-15000.00" }],
      total: "285000.00",
    }),
    order(12778, {
      status: "on-hold",
      line_items: [{ id: 31, name: "Gone Product", product_id: 0, variation_id: 0, quantity: 3, subtotal: "1000000.00", total: "1000000.00", meta_data: [] }],
      total: "1000000.00",
    }),
  ],
  orderNotes: {
    7328: [
      { id: 900, author: "WooCommerce", date_created_gmt: "2026-10-03T09:00:00", note: "Order status changed from Processing to Completed.", customer_note: false },
      { id: 901, author: "Shop Owner", date_created_gmt: "2026-10-03T09:05:00", note: "Thanks &amp; enjoy<br>See you", customer_note: true },
    ],
    7400: [{ id: 902, author: "WooCommerce", date_created_gmt: "2026-10-01T10:30:00", note: "Order status changed from Pending payment to Cancelled.", customer_note: false }],
    12778: [],
  },
  coupons: [
    {
      id: 50,
      code: "testcoupon",
      amount: "10.00",
      status: "publish",
      discount_type: "percent",
      description: "",
      date_created_gmt: "2026-01-01T00:00:00",
      date_modified_gmt: "2026-01-01T00:00:00",
      date_expires_gmt: null,
      usage_count: 1,
      individual_use: true,
      product_ids: [],
      excluded_product_ids: [101],
      usage_limit: null,
      usage_limit_per_user: 1,
      limit_usage_to_x_items: null,
      free_shipping: false,
      product_categories: [15],
      excluded_product_categories: [999],
      exclude_sale_items: false,
      minimum_amount: "800000.00",
      maximum_amount: "0.00",
      email_restrictions: [],
      used_by: ["20"],
    },
  ],
  affiliateWp: {
    // The affiliate's WordPress user (77) was deleted, and the referral's order (9999) too, as on live.
    affiliates: [{ affiliate_id: 8, user_id: 77, rate: "", rate_type: "", flat_rate_basis: "", payment_email: "Partner@Example.com", status: "active", earnings: 0, unpaid_earnings: 0, referrals: 1, visits: 1, date_registered: "2026-10-01 10:00:00" }],
    referrals: [{ referral_id: 3, affiliate_id: 8, visit_id: 4, customer_id: 2, parent_id: 0, description: "Test Vial", status: "rejected", amount: "140250.00", currency: "IDR", custom: "", context: "woocommerce", campaign: "", reference: "9999", products: [{ name: "Test Vial", id: 101, price: 1402500, referral_amount: "140250" }], date: "2026-10-02 10:00:00", type: "sale", flag: "", payout_id: 0 }],
    visits: [{ visit_id: 4, affiliate_id: 8, referral_id: 3, url: "https://example.com/?ref=partner", referrer: "", campaign: "", context: "", flag: "", ip: "198.51.100.9", date: "2026-10-02 09:00:00" }],
    customers: [{ customer_id: 2, user_id: 0, first_name: "Guest", last_name: "Buyer", email: "guest@example.com", ip: "198.51.100.9", date_created: "2026-10-02 10:00:00" }],
    payouts: [],
    creatives: [],
  },
});

describe("mapping rules", () => {
  it("reads WooCommerce amounts exactly", () => {
    expect(decimalToMinor("1300000.00")).toBe(130000000n);
    expect(decimalToMinor("-15000.00")).toBe(-1500000n);
    expect(decimalToMinor("140250")).toBe(14025000n);
    expect(decimalToMinor("0.005")).toBe(1n);
    expect(decimalToMinor(0)).toBe(0n);
    expect(decimalToMinor("")).toBeNull();
    expect(() => decimalToMinor("1,300")).toThrow();
  });

  it("reads dates without a zone as UTC, and WordPress's zero date as none", () => {
    expect(utcDate("2026-11-01T10:00:00")).toBe("2026-11-01T10:00:00.000Z");
    expect(utcDate("2026-11-01 10:00:00")).toBe("2026-11-01T10:00:00.000Z");
    expect(utcDate("2026-11-01T10:00:00+00:00")).toBe("2026-11-01T10:00:00.000Z");
    expect(utcDate("0000-00-00 00:00:00")).toBeNull();
  });

  it("turns note HTML into text and keeps WordPress roles", () => {
    expect(htmlToText("Thanks &amp; enjoy<br>See you")).toBe("Thanks & enjoy\nSee you");
    expect(htmlToText("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
    expect(wordpressRole(["subscriber"])).toBe("subscriber");
    expect(wordpressRole(["customer", "shop_manager"])).toBe("shop_manager");
  });

  it("maps an order with the owner's checkout fields, without the IP address", () => {
    const data = exportData();
    const mapped = mapOrder(data.orders[0], { productPathById: new Map([[100, "/product/test-pen/"]]), secret: SECRET, notes: data.orderNotes[7328] });
    expect(mapped.problems).toEqual([]);
    expect(mapped.order).toMatchObject({
      orderNumber: "7328",
      subtotalMinor: 130000000n,
      discountMinor: 13000000n,
      feesMinor: 5850000n,
      totalMinor: 122850000n,
      deliveryDay: "2026-10-02",
      deliveryTimeSlot: "09:00-12:00",
      deliveryLocation: { address: "Jl. Contoh 3, Ubud", lat: "-8.5", lng: "115.2" },
      attribution: { sourceType: "typein", utmSource: "(direct)" },
      shippingMethod: "free_shipping:2",
    });
    expect(mapped.order.billing).toMatchObject({ phoneCountryCode: "ID|+62", email: "buyer@example.com" });
    expect(mapped.order.customerIpHash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(mapped, (_, v) => (typeof v === "bigint" ? String(v) : v))).not.toContain("203.0.113.7");
    expect(mapped.items[0]).toMatchObject({ options: [{ label: "MG", value: "10 MG" }], variantLabel: "MG: 10 MG", productPath: "/product/test-pen/", lineDiscountMinor: 13000000n });
    expect(mapped.notes[1]).toMatchObject({ body: "Thanks & enjoy\nSee you", isCustomerNote: true });
  });

  it("starts the ledger as AffiliateWP's status says", () => {
    expect(commissionEntries({ status: "unpaid", amountMinor: 100n }).map((e) => e.amountMinor)).toEqual([100n]);
    expect(commissionEntries({ status: "rejected", amountMinor: 100n }).map((e) => e.amountMinor)).toEqual([100n, -100n]);
    expect(commissionEntries({ status: "pending", amountMinor: 100n })).toEqual([]);
  });

  it("counts the export the way the reconciliation expects", () => {
    expect(countExport(exportData())).toMatchObject({ users: 3, temporaryPasswords: 1, addresses: 2, orders: 3, orderNotes: 3, couponUsage: 1, referralEarningsMinor: "0", visitsConverted: 1 });
  });
});

describe("import into the real tables", () => {
  let pg;
  const query = async (text, params = []) => (await pg.query(text, params)).rows;
  const db = () => ({ run: (fn) => pg.transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows)) });

  beforeAll(async () => {
    pg = new PGlite();
    const dir = new URL("../../src/db/migrations/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  }, 60_000);

  it("imports everything and every reconciliation line matches", async () => {
    const { summary } = await importWordpress(exportData(), db(), { secret: SECRET, catalog });
    expect(summary.orders).toEqual({ source: 3, imported: 3, skipped: 0 });
    const rows = await reconcile(exportData(), query);
    expect(rows.filter((r) => !r.ok)).toEqual([]);
  }, 60_000);

  it("keeps live's quirks: a deleted user's affiliate, a deleted order's referral, a reversed commission", async () => {
    const [affiliate] = await query("SELECT user_id, username_slug, status, rate, payment_email FROM affiliates");
    expect(affiliate).toEqual({ user_id: null, username_slug: null, status: "active", rate: null, payment_email: "partner@example.com" });
    const [referral] = await query("SELECT order_id, reference, status, amount_minor::text AS amount FROM affiliate_referrals");
    expect(referral).toEqual({ order_id: null, reference: "9999", status: "rejected", amount: "14025000" });
    const [ledger] = await query("SELECT count(*)::int AS n, sum(amount_minor)::text AS balance FROM affiliate_commissions");
    expect(ledger).toEqual({ n: 2, balance: "0" });
    const [visit] = await query("SELECT referral_id IS NOT NULL AS converted, ip_hash FROM affiliate_visits");
    expect(visit.converted).toBe(true);
    expect(visit.ip_hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("makes accounts without passwords, with WordPress's roles and reminder", async () => {
    const users = await query("SELECT email, username, display_username, role, temporary_password FROM users ORDER BY legacy_wp_user_id");
    expect(users).toEqual([
      { email: "owner@example.com", username: "owner", display_username: "Owner", role: "administrator", temporary_password: false },
      { email: "buyer@example.com", username: "test.buyer", display_username: "test.buyer", role: "customer", temporary_password: true },
      { email: "reader@example.com", username: "reader", display_username: "reader", role: "subscriber", temporary_password: false },
    ]);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM accounts");
    expect(n).toBe(0);
    const [buyerOrder] = await query("SELECT o.user_id = u.id AS linked FROM orders o JOIN users u ON u.legacy_wp_user_id = 20 WHERE o.legacy_wc_order_id = 7328");
    expect(buyerOrder.linked).toBe(true);
  });

  it("stores coupons with WooCommerce's counters and the orders' coupon lines", async () => {
    const [coupon] = await query("SELECT code, usage_count, used_by, category_slugs, excluded_category_slugs, excluded_product_ids, minimum_amount_minor::text AS min, maximum_amount_minor AS max FROM coupons");
    expect(coupon).toEqual({ code: "testcoupon", usage_count: 1, used_by: ["20"], category_slugs: ["vial"], excluded_category_slugs: [], excluded_product_ids: [101], min: "80000000", max: null });
    const [redemption] = await query("SELECT r.coupon_id = c.id AS linked, r.amount_minor::text AS amount FROM coupon_redemptions r JOIN coupons c ON c.code = r.code");
    expect(redemption).toEqual({ linked: true, amount: "13000000" });
    const [log] = await query("SELECT errors FROM migration_logs WHERE step = 'coupons' ORDER BY started_at DESC LIMIT 1");
    expect(log.errors).toEqual([{ wcCouponId: 50, problem: "category not in the catalogue", ids: [999] }]);
  });

  it("never stores an IP address, and new orders count on from the highest number", async () => {
    for (const table of ["orders", "affiliate_visits", "affiliate_customers"]) {
      const rows = await query(`SELECT row_to_json(t)::text AS row FROM ${table} t`);
      for (const { row } of rows) expect(row).not.toMatch(/203\.0\.113\.7|198\.51\.100\.9/);
    }
    const [{ next }] = await query("SELECT nextval(pg_get_serial_sequence('orders', 'order_number'))::text AS next");
    expect(next).toBe("12779");
  });

  it("can run again without doubling anything", async () => {
    const before = await query("SELECT (SELECT count(*) FROM orders) o, (SELECT count(*) FROM order_items) i, (SELECT count(*) FROM order_notes) n, (SELECT count(*) FROM users) u, (SELECT count(*) FROM affiliate_commissions) c, (SELECT count(*) FROM payments) p");
    await importWordpress(exportData(), db(), { secret: SECRET, catalog });
    const after = await query("SELECT (SELECT count(*) FROM orders) o, (SELECT count(*) FROM order_items) i, (SELECT count(*) FROM order_notes) n, (SELECT count(*) FROM users) u, (SELECT count(*) FROM affiliate_commissions) c, (SELECT count(*) FROM payments) p");
    expect(after).toEqual(before);
    expect((await reconcile(exportData(), query)).filter((r) => !r.ok)).toEqual([]);
  }, 60_000);
});
