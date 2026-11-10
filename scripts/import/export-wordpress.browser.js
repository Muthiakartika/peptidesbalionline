/*
 * The WordPress export for scripts/import/import-wordpress.mjs. Runs IN THE BROWSER, in a tab where the owner
 * is signed in to https://peptidesbali.online as an administrator (any page with the admin bar: it uses
 * WordPress's own wp.apiFetch and its nonce). Paste it into the DevTools console, or run it from the in-app
 * browser. It only READS (GET requests to the REST API): nothing on the site changes.
 *
 * What it collects, field by field (an allow-list: nothing else leaves the site):
 *   users (wp/v2/users), WooCommerce customers, orders (status "any": trash left out), each order's notes,
 *   coupons, and AffiliateWP's affiliates, referrals, visits, customers, payouts and creatives.
 *   liveTotals: WordPress's own X-WP-Total counts, to check the export is complete.
 *   skipped: what is left out on purpose (trashed orders, comments held for moderation, RewardsWP).
 * Not available through any API, so not here: WordPress password hashes (Q-07), RewardsWP's data (the plugin
 * is switched off), Atlas Research Planner's saved plans and tracker, Atlas Email Automations' contacts.
 *
 * The result stays in the page (window.__atlasExport) until window.__atlasDownloadExport() saves it as
 * peptidesbali-export-<date>.json. That file holds customers' personal data: keep it outside the project
 * folder and delete it after the import. The summary this script returns has counts only.
 */
await (async () => {
  if (!window.wp?.apiFetch) throw new Error("Open this on peptidesbali.online while signed in as an administrator (wp.apiFetch is missing).");
  const api = (path, options = {}) => window.wp.apiFetch({ path, ...options });
  const pick = (object, keys) => Object.fromEntries(keys.filter((k) => object && k in object).map((k) => [k, object[k]]));
  const total = async (path) => Number((await api(path, { parse: false })).headers.get("X-WP-Total"));
  const pages = async (base) => {
    const rows = [];
    for (let page = 1; page < 100; page++) {
      const batch = await api(`${base}${base.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      rows.push(...batch);
      if (batch.length < 100) break;
    }
    return rows;
  };
  const affwp = async (endpoint) => {
    try {
      return await api(`/affwp/v1/${endpoint}?number=-1`);
    } catch (error) {
      if (/^no_/.test(error?.code ?? "")) return []; // AffiliateWP answers 404 "no_payouts" when there are none
      throw error;
    }
  };

  const USER_FIELDS = ["id", "username", "name", "first_name", "last_name", "email", "url", "roles", "registered_date"];
  const CUSTOMER_FIELDS = ["id", "email", "first_name", "last_name", "role", "username", "billing", "shipping", "date_created_gmt", "date_modified_gmt", "is_paying_customer"];
  const CUSTOMER_META = ["billing_phone_country_code", "default_password_nag"];
  const ORDER_FIELDS = [
    "id", "parent_id", "number", "order_key", "status", "currency", "date_created_gmt", "date_modified_gmt", "date_paid_gmt", "date_completed_gmt",
    "discount_total", "discount_tax", "shipping_total", "shipping_tax", "cart_tax", "total", "total_tax", "prices_include_tax", "customer_id",
    "billing", "shipping", "payment_method", "payment_method_title", "transaction_id", "customer_ip_address", "customer_user_agent", "created_via",
    "customer_note", "refunds",
  ];
  const ORDER_META = /^(_delivery_day|_delivery_time_slot|_atlas_delivery_latitude|_atlas_delivery_longitude|_atlas_google_formatted_address|_billing_phone_country_code|_wc_order_attribution_[a-z_]+|_nowpayments_payment_id|_nowpayments_last_status|_rewardswp_first_order_points_skipped)$/;
  const COUPON_FIELDS = [
    "id", "code", "amount", "status", "date_created_gmt", "date_modified_gmt", "discount_type", "description", "date_expires_gmt", "usage_count",
    "individual_use", "product_ids", "excluded_product_ids", "usage_limit", "usage_limit_per_user", "limit_usage_to_x_items", "free_shipping",
    "product_categories", "excluded_product_categories", "exclude_sale_items", "minimum_amount", "maximum_amount", "email_restrictions", "used_by",
  ];

  const users = (await pages("/wp/v2/users?context=edit")).map((u) => pick(u, USER_FIELDS));
  const customers = (await pages("/wc/v3/customers?role=all")).map((c) => ({
    ...pick(c, CUSTOMER_FIELDS),
    meta_data: c.meta_data.filter((m) => CUSTOMER_META.includes(m.key)).map((m) => pick(m, ["key", "value"])),
  }));
  const orders = (await pages("/wc/v3/orders?status=any&orderby=id&order=asc")).map((o) => ({
    ...pick(o, ORDER_FIELDS),
    meta_data: o.meta_data.filter((m) => ORDER_META.test(m.key)).map((m) => pick(m, ["key", "value"])),
    line_items: o.line_items.map((i) => ({
      ...pick(i, ["id", "name", "parent_name", "product_id", "variation_id", "quantity", "subtotal", "subtotal_tax", "total", "total_tax", "sku", "price"]),
      meta_data: i.meta_data.map((m) => pick(m, ["key", "value", "display_key", "display_value"])),
    })),
    fee_lines: o.fee_lines.map((f) => pick(f, ["id", "name", "total", "total_tax"])),
    shipping_lines: o.shipping_lines.map((s) => pick(s, ["id", "method_id", "instance_id", "method_title", "total", "total_tax"])),
    coupon_lines: o.coupon_lines.map((c) => pick(c, ["id", "code", "discount", "discount_tax"])),
  }));

  // Each order's notes (WooCommerce gives them per order), 8 at a time.
  const orderNotes = {};
  let notesRead = 0;
  for (let start = 0; start < orders.length; start += 8) {
    await Promise.all(
      orders.slice(start, start + 8).map(async (o) => {
        const notes = await api(`/wc/v3/orders/${o.id}/notes?type=any`);
        orderNotes[o.id] = notes.map((n) => pick(n, ["id", "author", "date_created_gmt", "note", "customer_note"]));
        notesRead++;
      }),
    );
  }

  const coupons = (await pages("/wc/v3/coupons")).map((c) => pick(c, COUPON_FIELDS));
  const affiliateWp = {
    affiliates: (await affwp("affiliates")).map((a) => pick(a, ["affiliate_id", "user_id", "rate", "rate_type", "flat_rate_basis", "payment_email", "status", "earnings", "unpaid_earnings", "referrals", "visits", "date_registered"])),
    referrals: (await affwp("referrals")).map((r) => pick(r, ["referral_id", "affiliate_id", "visit_id", "customer_id", "parent_id", "description", "status", "amount", "currency", "custom", "context", "campaign", "reference", "products", "date", "type", "flag", "payout_id"])),
    visits: (await affwp("visits")).map((v) => pick(v, ["visit_id", "affiliate_id", "referral_id", "url", "referrer", "campaign", "context", "flag", "ip", "date"])),
    customers: (await affwp("customers")).map((c) => pick(c, ["customer_id", "user_id", "first_name", "last_name", "email", "ip", "date_created"])),
    payouts: (await affwp("payouts")).map((p) => pick(p, ["payout_id", "affiliate_id", "referrals", "amount", "owner", "payout_method", "status", "date"])),
    creatives: (await affwp("creatives")).map((c) => pick(c, ["creative_id", "name", "description", "url", "text", "image", "status", "date"])),
  };

  const liveTotals = {
    users: await total("/wp/v2/users?per_page=1&context=edit"),
    customers: await total("/wc/v3/customers?role=all&per_page=1"),
    orders: await total("/wc/v3/orders?status=any&per_page=1"),
    coupons: await total("/wc/v3/coupons?per_page=1"),
    ordersWithNotesFetched: notesRead,
  };
  const skipped = {
    "orders in the trash": await total("/wc/v3/orders?status=trash&per_page=1"),
    "comments held for moderation (none approved)": await total("/wp/v2/comments?status=hold&per_page=1&context=edit"),
    "RewardsWP data": "plugin switched off: no API (needs a database export, Q-27)",
  };

  const data = { version: 1, source: location.origin, exportedAt: new Date().toISOString(), liveTotals, skipped, users, customers, orders, orderNotes, coupons, affiliateWp };
  const text = JSON.stringify(data);
  const fileName = `peptidesbali-export-${data.exportedAt.slice(0, 10)}.json`;
  window.__atlasExport = text;
  window.__atlasDownloadExport = () => {
    const url = URL.createObjectURL(new Blob([window.__atlasExport], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return fileName;
  };
  return {
    fileName,
    bytes: text.length,
    counts: {
      users: users.length,
      customers: customers.length,
      orders: orders.length,
      orderNotes: Object.values(orderNotes).reduce((n, list) => n + list.length, 0),
      coupons: coupons.length,
      ...Object.fromEntries(Object.entries(affiliateWp).map(([k, v]) => [`affiliateWp.${k}`, v.length])),
    },
    liveTotals,
    skipped,
  };
})();
