/**
 * The WordPress export (the shape scripts/import/export-wordpress.browser.js makes from WordPress's REST API)
 * rebuilt from a MySQL dump of the live database, so the same importer (wordpress-import.mjs: mapping, import,
 * reconciliation) can run on a dump instead of a signed-in browser. Read-only; nothing here touches a database.
 *
 *   users, customers   wp_users + wp_usermeta (roles, names, saved billing / shipping address)
 *   orders             WooCommerce's HPOS tables (wc_orders, addresses, operational data, meta) + their lines
 *                      (woocommerce_order_items / _itemmeta: line, fee, shipping and coupon items)
 *   orderNotes         wp_comments of type order_note
 *   coupons            shop_coupon posts + their post meta
 *   affiliateWp        AffiliateWP's own tables (affiliates, referrals, visits, customers)
 * Left out like the browser export does: orders in the trash. Not in a dump's reach (and not needed): payouts and
 * creatives are empty on live.
 *
 * The result has the personal data of every customer: callers keep it in memory (or in a file outside the project)
 * and print counts only.
 */
import { readMysqlTables } from "./mysqldump.mjs";
import { EXPORT_VERSION } from "./wordpress-mapping.mjs";

/** The order meta the browser export keeps (an allow-list: nothing else is read). */
const ORDER_META = /^(_delivery_day|_delivery_time_slot|_atlas_delivery_latitude|_atlas_delivery_longitude|_atlas_google_formatted_address|_billing_phone_country_code|_wc_order_attribution_[a-z_]+|_nowpayments_payment_id|_nowpayments_last_status|_rewardswp_first_order_points_skipped)$/;
const COUPON_META = new Set([
  "discount_type", "coupon_amount", "date_expires", "expiry_date", "usage_count", "individual_use", "product_ids", "exclude_product_ids", "usage_limit", "usage_limit_per_user",
  "limit_usage_to_x_items", "free_shipping", "product_categories", "exclude_product_categories", "exclude_sale_items", "minimum_amount", "maximum_amount", "customer_email", "_used_by",
]);
const ADDRESS_FIELDS = ["first_name", "last_name", "company", "address_1", "address_2", "city", "state", "postcode", "country"];

/** PHP's serialize() output ("a:1:{s:8:\"customer\";b:1;}") as plain values (arrays become objects keyed by their index or name). */
export function phpUnserialize(text) {
  const buf = Buffer.from(String(text), "utf8");
  let i = 0;
  const until = (char) => {
    const j = buf.indexOf(char, i);
    if (j < 0) throw new Error("Not a PHP serialized value.");
    const piece = buf.toString("utf8", i, j);
    i = j + 1;
    return piece;
  };
  const read = () => {
    const type = String.fromCharCode(buf[i]);
    if (type === "N") {
      i += 2;
      return null;
    }
    i += 2;
    if (type === "i" || type === "d") return Number(until(";"));
    if (type === "b") return until(";") === "1";
    if (type === "s") {
      const length = Number(until(":"));
      i += 1;
      const value = buf.toString("utf8", i, i + length);
      i += length + 2;
      return value;
    }
    if (type === "a") {
      const count = Number(until(":"));
      i += 1;
      const out = {};
      for (let k = 0; k < count; k++) {
        const key = read();
        out[key] = read();
      }
      i += 1;
      return out;
    }
    throw new Error(`Unsupported serialized type "${type}".`);
  };
  return read();
}

/**
 * Text that was UTF-8, read as Windows-1252 and written out as UTF-8 again ("â€“" for "–", "â€™" for "’", "Ã©" for
 * "é"): this dump has it in every text column. Undoing it is exact when every character maps back to a byte and the
 * bytes are valid UTF-8; anything else (plain ASCII, properly encoded text) is returned unchanged.
 */
// Windows-1252's characters for the bytes 0x80-0x9F (written out: Node's TextDecoder is plain Latin-1 without full ICU).
const CP1252_HIGH = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d,
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};
const CP1252_BYTE = (() => {
  const map = new Map();
  for (let byte = 0; byte < 256; byte++) map.set(String.fromCharCode(CP1252_HIGH[byte] ?? byte), byte);
  // Some tools keep the bytes 0x80-0x9F as the control characters U+0080-U+009F instead of "€ ‘ ’ …".
  for (let byte = 0x80; byte <= 0x9f; byte++) map.set(String.fromCharCode(byte), byte);
  return map;
})();
const UTF8 = new TextDecoder("utf-8", { fatal: true });
export function fixMojibake(text) {
  if (typeof text !== "string" || !/[^\x00-\x7f]/.test(text)) return text;
  const bytes = [];
  for (const char of text) {
    const byte = CP1252_BYTE.get(char);
    if (byte === undefined) return text;
    bytes.push(byte);
  }
  try {
    return UTF8.decode(Uint8Array.from(bytes));
  } catch {
    return text;
  }
}
const fixDeep = (value) =>
  typeof value === "string" ? fixMojibake(value) : Array.isArray(value) ? value.map(fixDeep) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixDeep(v)])) : value;

/** WooCommerce's number format in the REST API: "5" → "5.00". */
const decimal = (value) => (value === null || value === undefined || value === "" || Number.isNaN(Number(value)) ? blank(value) : Number(value).toFixed(2));

const safeUnserialize = (text) => {
  try {
    return text ? phpUnserialize(text) : null;
  } catch {
    return null;
  }
};
const listOf = (text) => {
  const value = safeUnserialize(text);
  return value && typeof value === "object" ? Object.values(value) : [];
};

const group = (rows, key) => {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
};
const blank = (value) => (value === null || value === undefined ? "" : String(value));
const nullable = (value) => (value === null || value === undefined || value === "" ? null : value);
const positiveInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const yes = (value) => value === "yes" || value === "1";
/**
 * WooCommerce's coupon expiry as an ISO date, or null: a unix timestamp (date_expires; the legacy expiry_date key can
 * hold one too, as RewardsWP's coupons do) or an old-style "2027-01-28" date.
 */
const expiryDate = (value) => {
  if (positiveInt(value) && /^\d{9,}$/.test(String(value))) return new Date(Number(value) * 1000).toISOString();
  const parsed = value ? Date.parse(`${String(value).trim()}${/^\d{4}-\d\d-\d\d$/.test(String(value).trim()) ? "T00:00:00Z" : ""}`) : Number.NaN;
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

/**
 * @param {string} file the dump (.sql or .sql.gz)
 * @param {{ prefix?: string }} [options] the table prefix (wp_ unless the database says otherwise)
 */
export async function buildExportFromDump(file, { prefix = "wp_" } = {}) {
  const p = (name) => `${prefix}${name}`;
  const tableNames = [
    "users", "usermeta", "wc_orders", "wc_order_addresses", "wc_order_operational_data", "wc_orders_meta", "woocommerce_order_items", "woocommerce_order_itemmeta",
    "comments", "commentmeta", "woocommerce_attribute_taxonomies", "terms", "term_taxonomy", "posts", "postmeta",
    "affiliate_wp_affiliates", "affiliate_wp_referrals", "affiliate_wp_visits", "affiliate_wp_customers",
  ].map(p);
  const USERMETA = new RegExp(`^(first_name|last_name|default_password_nag|billing_[a-z0-9_]+|shipping_[a-z0-9_]+|${prefix}capabilities)$`);
  const t = await readMysqlTables(file, tableNames, {
    filters: {
      [p("usermeta")]: (row) => USERMETA.test(row.meta_key ?? ""),
      [p("wc_orders_meta")]: (row) => ORDER_META.test(row.meta_key ?? ""),
      [p("comments")]: (row) => row.comment_type === "order_note",
      [p("commentmeta")]: (row) => row.meta_key === "is_customer_note",
      [p("posts")]: (row) => row.post_type === "shop_coupon",
      [p("postmeta")]: (row) => COUPON_META.has(row.meta_key ?? ""),
    },
  });
  const rows = (name) => t[p(name)].rows;
  if (!t[p("users")].columns.length) throw new Error(`No ${p("users")} table in this dump: is the table prefix "${prefix}"?`);

  // ── Users and WooCommerce customers (the saved addresses are in the user meta)
  const metaByUser = new Map([...group(rows("usermeta"), "user_id")].map(([id, list]) => [id, new Map(list.map((m) => [m.meta_key, m.meta_value]))]));
  const users = [];
  const customers = [];
  for (const u of rows("users")) {
    const meta = metaByUser.get(u.ID) ?? new Map();
    const capabilities = safeUnserialize(meta.get(`${prefix}capabilities`));
    const roles = capabilities ? Object.entries(capabilities).filter(([, on]) => on).map(([role]) => role) : [];
    const address = (type) => ({
      ...Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, blank(meta.get(`${type}_${f}`))])),
      ...(type === "billing" ? { email: blank(meta.get("billing_email")) } : {}),
      phone: blank(meta.get(`${type}_phone`)),
    });
    users.push({ id: Number(u.ID), username: u.user_login, name: u.display_name, first_name: blank(meta.get("first_name")), last_name: blank(meta.get("last_name")), email: u.user_email, url: blank(u.user_url), roles, registered_date: u.user_registered });
    customers.push({
      id: Number(u.ID),
      email: u.user_email,
      first_name: blank(meta.get("first_name")),
      last_name: blank(meta.get("last_name")),
      role: roles[0] ?? "customer",
      username: u.user_login,
      billing: address("billing"),
      shipping: address("shipping"),
      date_created_gmt: u.user_registered,
      meta_data: ["billing_phone_country_code", "default_password_nag"].filter((key) => meta.has(key)).map((key) => ({ key, value: meta.get(key) })),
    });
  }

  // ── Orders (trash left out, like the browser export)
  const operational = new Map(rows("wc_order_operational_data").map((r) => [r.order_id, r]));
  const addressesByOrder = group(rows("wc_order_addresses"), "order_id");
  const metaByOrder = group(rows("wc_orders_meta"), "order_id");
  const itemsByOrder = group(rows("woocommerce_order_items"), "order_id");
  const itemMeta = group(rows("woocommerce_order_itemmeta"), "order_item_id");
  const attributeLabels = new Map(rows("woocommerce_attribute_taxonomies").map((a) => [`pa_${a.attribute_name}`, a.attribute_label]));
  const taxonomyOfTerm = new Map(rows("term_taxonomy").map((tt) => [tt.term_id, tt.taxonomy]));
  const termNames = new Map(); // "pa_mg|20-mg" → "20 MG"
  for (const term of rows("terms")) {
    const taxonomy = taxonomyOfTerm.get(term.term_id);
    if (taxonomy?.startsWith("pa_")) termNames.set(`${taxonomy}|${term.slug}`, term.name);
  }

  const orderRows = rows("wc_orders").filter((o) => o.type === "shop_order" && o.status !== "trash");
  const trashed = rows("wc_orders").filter((o) => o.type === "shop_order" && o.status === "trash").length;
  const orders = orderRows
    .map((o) => {
      const op = operational.get(o.id) ?? {};
      const addresses = addressesByOrder.get(o.id) ?? [];
      const address = (type) => {
        const a = addresses.find((r) => r.address_type === type) ?? {};
        return { ...Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, blank(a[f])])), ...(type === "billing" ? { email: blank(a.email) } : {}), phone: blank(a.phone) };
      };
      const lineItems = [];
      const feeLines = [];
      const shippingLines = [];
      const couponLines = [];
      for (const item of itemsByOrder.get(o.id) ?? []) {
        const metas = itemMeta.get(item.order_item_id) ?? [];
        const get = (key) => metas.find((m) => m.meta_key === key)?.meta_value;
        const id = Number(item.order_item_id);
        if (item.order_item_type === "line_item") {
          // A line whose total was edited above its subtotal (an admin's hand edit) has no negative discount: as the browser export gave it, the subtotal follows.
          const subtotal = Number(get("_line_total")) > Number(get("_line_subtotal")) ? get("_line_total") : get("_line_subtotal");
          lineItems.push({
            id,
            name: item.order_item_name,
            product_id: Number(get("_product_id") ?? 0),
            variation_id: Number(get("_variation_id") ?? 0),
            quantity: Number(get("_qty") ?? 0),
            subtotal: blank(subtotal),
            total: blank(get("_line_total")),
            // What WooCommerce shows under the name: attributes by their label and term name, other meta as it is.
            meta_data: metas
              .filter((m) => !String(m.meta_key).startsWith("_"))
              .map((m) =>
                String(m.meta_key).startsWith("pa_")
                  ? { key: m.meta_key, value: m.meta_value, display_key: attributeLabels.get(m.meta_key) ?? m.meta_key, display_value: termNames.get(`${m.meta_key}|${m.meta_value}`) ?? m.meta_value }
                  : { key: m.meta_key, value: m.meta_value, display_key: m.meta_key, display_value: m.meta_value },
              ),
          });
        } else if (item.order_item_type === "fee") feeLines.push({ id, name: item.order_item_name, total: blank(get("_line_total")), total_tax: blank(get("_line_tax")) });
        else if (item.order_item_type === "shipping") shippingLines.push({ id, method_id: blank(get("method_id")), instance_id: blank(get("instance_id")), method_title: item.order_item_name, total: blank(get("cost")), total_tax: blank(get("total_tax")) });
        else if (item.order_item_type === "coupon") couponLines.push({ id, code: item.order_item_name, discount: blank(get("discount_amount")), discount_tax: blank(get("discount_amount_tax")) });
      }
      return {
        id: Number(o.id),
        parent_id: Number(o.parent_order_id ?? 0),
        number: String(o.id),
        order_key: blank(op.order_key),
        status: o.status.replace(/^wc-/, ""),
        currency: blank(o.currency) || "IDR",
        date_created_gmt: o.date_created_gmt,
        date_modified_gmt: o.date_updated_gmt,
        date_paid_gmt: nullable(op.date_paid_gmt),
        date_completed_gmt: nullable(op.date_completed_gmt),
        discount_total: blank(op.discount_total_amount),
        discount_tax: blank(op.discount_tax_amount),
        shipping_total: blank(op.shipping_total_amount),
        shipping_tax: blank(op.shipping_tax_amount),
        total: blank(o.total_amount),
        total_tax: blank(o.tax_amount),
        prices_include_tax: yes(op.prices_include_tax),
        customer_id: Number(o.customer_id ?? 0),
        billing: address("billing"),
        shipping: address("shipping"),
        payment_method: blank(o.payment_method),
        payment_method_title: blank(o.payment_method_title),
        transaction_id: blank(o.transaction_id),
        customer_ip_address: blank(o.ip_address),
        customer_user_agent: blank(o.user_agent),
        created_via: blank(op.created_via),
        customer_note: blank(o.customer_note),
        refunds: [],
        meta_data: (metaByOrder.get(o.id) ?? []).map((m) => ({ key: m.meta_key, value: m.meta_value })),
        line_items: lineItems,
        fee_lines: feeLines,
        shipping_lines: shippingLines,
        coupon_lines: couponLines,
      };
    })
    .sort((a, b) => a.id - b.id);

  // ── Order notes (a note is a comment of type order_note on the order)
  const customerNote = new Set(rows("commentmeta").filter((m) => m.meta_value === "1").map((m) => m.comment_id));
  const notesByOrder = group(rows("comments"), "comment_post_ID");
  const orderNotes = {};
  for (const o of orders) {
    orderNotes[o.id] = (notesByOrder.get(String(o.id)) ?? [])
      .map((n) => ({ id: Number(n.comment_ID), author: n.comment_author, date_created_gmt: n.comment_date_gmt, note: n.comment_content, customer_note: customerNote.has(n.comment_ID) }))
      .sort((a, b) => a.id - b.id);
  }

  // ── Coupons
  const metaByPost = group(rows("postmeta"), "post_id");
  const coupons = rows("posts")
    .filter((post) => !["trash", "auto-draft"].includes(post.post_status))
    .map((post) => {
      const metas = metaByPost.get(post.ID) ?? [];
      const get = (key) => metas.find((m) => m.meta_key === key)?.meta_value;
      const ids = (key) => String(get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
      return {
        id: Number(post.ID),
        code: post.post_title,
        amount: decimal(get("coupon_amount")) || "0.00",
        status: post.post_status,
        date_created_gmt: post.post_date_gmt,
        date_modified_gmt: post.post_modified_gmt,
        discount_type: blank(get("discount_type")) || "fixed_cart",
        description: blank(post.post_excerpt),
        date_expires_gmt: expiryDate(get("date_expires")) ?? expiryDate(get("expiry_date")),
        usage_count: Number(get("usage_count") ?? 0),
        individual_use: yes(get("individual_use")),
        product_ids: ids("product_ids"),
        excluded_product_ids: ids("exclude_product_ids"),
        usage_limit: positiveInt(get("usage_limit")),
        usage_limit_per_user: positiveInt(get("usage_limit_per_user")),
        limit_usage_to_x_items: positiveInt(get("limit_usage_to_x_items")),
        free_shipping: yes(get("free_shipping")),
        product_categories: listOf(get("product_categories")).map(Number),
        excluded_product_categories: listOf(get("exclude_product_categories")).map(Number),
        exclude_sale_items: yes(get("exclude_sale_items")),
        minimum_amount: blank(get("minimum_amount")),
        maximum_amount: blank(get("maximum_amount")),
        email_restrictions: listOf(get("customer_email")).map(String),
        used_by: metas.filter((m) => m.meta_key === "_used_by").map((m) => m.meta_value),
      };
    })
    .sort((a, b) => a.id - b.id);

  // ── AffiliateWP (the tables are the same ones its REST API reads)
  const affiliateWp = {
    affiliates: rows("affiliate_wp_affiliates").map((a) => ({ affiliate_id: a.affiliate_id, user_id: a.user_id, rate: a.rate, rate_type: a.rate_type, flat_rate_basis: a.flat_rate_basis, payment_email: a.payment_email, status: a.status, earnings: a.earnings, unpaid_earnings: a.unpaid_earnings, referrals: a.referrals, visits: a.visits, date_registered: a.date_registered })),
    referrals: rows("affiliate_wp_referrals").map((r) => ({ referral_id: r.referral_id, affiliate_id: r.affiliate_id, visit_id: r.visit_id, customer_id: r.customer_id, parent_id: r.parent_id, description: r.description, status: r.status, amount: r.amount, currency: r.currency, custom: r.custom, context: r.context, campaign: r.campaign, reference: r.reference, products: r.products, date: r.date, type: r.type, flag: r.flag, payout_id: r.payout_id })),
    visits: rows("affiliate_wp_visits").map((v) => ({ visit_id: v.visit_id, affiliate_id: v.affiliate_id, referral_id: v.referral_id, url: v.url, referrer: v.referrer, campaign: v.campaign, context: v.context, flag: v.flag, ip: v.ip, date: v.date })),
    customers: rows("affiliate_wp_customers").map((c) => ({ customer_id: c.customer_id, user_id: c.user_id, first_name: c.first_name, last_name: c.last_name, email: c.email, ip: c.ip, date_created: c.date_created })),
    payouts: [],
    creatives: [],
  };

  return fixDeep({
    version: EXPORT_VERSION,
    source: "mysql dump",
    exportedAt: new Date().toISOString(),
    // A dump has no second source to check itself against (the browser export reads WordPress's own X-WP-Total), so these are its own counts.
    liveTotals: { users: users.length, customers: customers.length, orders: orders.length, coupons: coupons.length, ordersWithNotesFetched: orders.length },
    skipped: { "orders in the trash": trashed, "comments held for moderation (none approved)": "not read from a dump", "RewardsWP data": "imported by scripts/import/import-rewardswp.mjs (docs/setup/rewards.md)" },
    users,
    customers,
    orders,
    orderNotes,
    coupons,
    affiliateWp,
  });
}
