/**
 * How the WordPress / WooCommerce / AffiliateWP export (scripts/import/export-wordpress.browser.js) maps to this
 * project's tables. Pure functions, no database: tested in wordpress-import.test.mjs, used by
 * wordpress-import.mjs.
 *
 * The rules come from the live data (7 Nov 2026, read as counts and field names only):
 *   * amounts are WooCommerce decimal strings with 2 decimals ("1300000.00", IDR) → bigint minor units;
 *   * "…_gmt" dates have no zone (UTC); AffiliateWP dates ("2026-11-01 10:00:00") are in the site's time,
 *     which is UTC on live (Q-50);
 *   * the owner's checkout fields are order meta: _delivery_day ("2026-11-01"), _delivery_time_slot
 *     ("09:00-12:00"), _atlas_delivery_latitude / _longitude, _atlas_google_formatted_address and
 *     _billing_phone_country_code ("ID|+62"); WooCommerce's attribution is _wc_order_attribution_*;
 *   * IP addresses are never stored, only a keyed hash.
 */
import { createHmac, randomUUID } from "node:crypto";

export const EXPORT_VERSION = 1;
export const ORDER_STATUSES = ["checkout-draft", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"];
export const AFFILIATE_STATUSES = ["active", "inactive", "pending", "rejected"];
export const REFERRAL_STATUSES = ["pending", "unpaid", "paid", "rejected", "draft"];
export const COUPON_TYPES = ["percent", "fixed_cart", "fixed_product"];

/**
 * AffiliateWP's settings as read in wp-admin on 6 Nov 2026 (docs/audit/backend-settings.md §9). They aren't in
 * any REST endpoint, so they are written here once; change them here (or later in the admin) if the owner
 * changes them on live.
 */
export const AFFILIATE_SETTINGS_SOURCE = "AffiliateWP 2.37.4 settings read in wp-admin, 6 Nov 2026 (docs/audit/backend-settings.md §9)";
export const AFFILIATE_SETTINGS = {
  referral_rate: "10",
  referral_rate_type: "percentage",
  exclude_shipping: true,
  exclude_tax: true,
  multi_tier: false,
  recurring: false,
  holding_period_days: 0,
  reject_unpaid_referrals_on_refund: true,
  ignore_zero_referrals: false,
  cookie_days: 30,
  credit_last_referrer: false,
  referral_variable: "ref",
  referral_format: "username",
  pretty_affiliate_urls: true,
  direct_link_tracking: false,
  affiliate_landing_pages: false,
  registration_open: true,
  require_approval: true,
  required_registration_fields: ["name", "website"],
  self_referrals: "reject",
  payouts_service: null,
  affiliate_coupon_template: { format: "{user_name}-{coupon_amount}", amount: "10", type: "percent" },
  affiliate_link_discounts: true,
  sharing: ["facebook", "email", "qr_code"],
  currency: "IDR",
  ip_logging: true,
  monthly_summary_emails: true,
};

/** A new user ID (Better Auth's IDs are random text; any unique text works). */
export const newUserId = () => randomUUID().replace(/-/g, "");

/**
 * "1300000.00" → 130000000n. More decimals are rounded half up; an empty value gives `empty` (null unless
 * set). Throws on anything that isn't a plain decimal, so a strange value stops the import instead of
 * becoming a wrong amount.
 */
export function decimalToMinor(value, { decimals = 2, empty = null } = {}) {
  if (value === null || value === undefined || value === "") return empty;
  const text = typeof value === "number" ? value.toFixed(decimals + 1) : String(value).trim();
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === "" && !match[3])) throw new Error(`Not an amount: ${JSON.stringify(value)}`);
  const [, minus, whole, fraction = ""] = match;
  const digits = (fraction + "0".repeat(decimals + 1)).slice(0, decimals + 1);
  let minor = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(digits.slice(0, decimals) || "0");
  if (Number(digits[decimals]) >= 5) minor += 1n;
  return minus && minor !== 0n ? -minor : minor;
}

/** A date without a zone is UTC ("2026-11-01T10:00:00", "2026-11-01 10:00:00"); WordPress's zero date is null. */
export function utcDate(value) {
  if (!value) return null;
  const text = String(value).trim().replace(" ", "T");
  if (/^0000-00-00/.test(text)) return null;
  const date = new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Not a date: ${JSON.stringify(value)}`);
  return date.toISOString();
}

export const meta = (metaData, key) => (Array.isArray(metaData) ? metaData.find((m) => m.key === key)?.value : undefined);
const text = (value) => (value === null || value === undefined || value === "" ? null : String(value));

/** A keyed hash of an IP address (the key is the site's BETTER_AUTH_SECRET), so the address itself is never kept. */
export function hashIp(ip, secret) {
  if (!ip) return null;
  if (!secret) throw new Error("hashIp needs a secret (BETTER_AUTH_SECRET).");
  return createHmac("sha256", secret).update(`ip|${String(ip).trim()}`).digest("hex").slice(0, 32);
}

/** WooCommerce notes and labels can hold a little HTML ("<br>", links, entities): the pages here show plain text. */
export function htmlToText(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .trim();
}

/** The WordPress role kept on the account (only administrator and shop_manager open the staff screens). */
export function wordpressRole(roles) {
  const list = Array.isArray(roles) ? roles : [];
  for (const role of ["administrator", "shop_manager", "customer", "subscriber"]) if (list.includes(role)) return role;
  return list[0] ?? "customer";
}

/**
 * A WordPress user (wp/v2/users, context=edit) with its WooCommerce customer record, as an account here.
 * There is no password: WordPress's password hashes aren't in any API (Q-07), so imported customers set a
 * new one with "Lost your password?". WooCommerce's `default_password_nag` ("1") becomes the
 * temporary-password reminder.
 */
export function mapUser(wpUser, customer) {
  const email = String(wpUser?.email || customer?.email || "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const username = String(wpUser?.username || customer?.username || "").trim();
  const firstName = text(wpUser?.first_name || customer?.first_name);
  const lastName = text(wpUser?.last_name || customer?.last_name);
  return {
    legacyWpUserId: Number(wpUser?.id ?? customer?.id),
    email,
    name: String(wpUser?.name || [firstName, lastName].filter(Boolean).join(" ") || username || email).trim(),
    username: username ? username.toLowerCase() : null,
    displayUsername: username || null,
    firstName,
    lastName,
    role: wordpressRole(wpUser?.roles ?? (customer?.role ? [customer.role] : [])),
    temporaryPassword: String(meta(customer?.meta_data, "default_password_nag") ?? "") === "1",
    websiteUrl: text(wpUser?.url),
    createdAt: utcDate(wpUser?.registered_date) ?? utcDate(customer?.date_created_gmt) ?? new Date().toISOString(),
  };
}

/** The saved billing / shipping address of a WooCommerce customer (only the ones with something filled in). */
export function mapAddresses(customer) {
  const rows = [];
  for (const type of ["billing", "shipping"]) {
    const a = customer?.[type];
    if (!a) continue;
    const row = {
      type,
      firstName: text(a.first_name),
      lastName: text(a.last_name),
      company: text(a.company),
      address1: text(a.address_1),
      address2: text(a.address_2),
      city: text(a.city),
      state: text(a.state),
      postcode: text(a.postcode),
      country: text(a.country),
      phone: text(a.phone),
      phoneCountryCode: type === "billing" ? text(meta(customer.meta_data, "billing_phone_country_code")) : null,
      email: type === "billing" ? text(a.email)?.toLowerCase() ?? null : null,
    };
    if ([row.firstName, row.lastName, row.company, row.address1, row.address2, row.city, row.postcode, row.phone].some(Boolean)) rows.push(row);
  }
  return rows;
}

const ATTRIBUTION_KEYS = [
  "source_type",
  "referrer",
  "utm_campaign",
  "utm_source",
  "utm_medium",
  "utm_content",
  "utm_id",
  "utm_term",
  "session_entry",
  "session_start_time",
  "session_pages",
  "session_count",
  "user_agent",
  "device_type",
];
const camel = (key) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function address(a, { email, phoneCountryCode } = {}) {
  const row = {
    firstName: a?.first_name ?? "",
    lastName: a?.last_name ?? "",
    phone: a?.phone ?? "",
    ...(phoneCountryCode !== undefined ? { phoneCountryCode } : {}),
    ...(email !== undefined ? { email } : {}),
    address1: a?.address_1 ?? "",
    city: a?.city ?? "",
    state: a?.state ?? "",
    postcode: a?.postcode ?? "",
    country: a?.country ?? "",
  };
  if (a?.company) row.company = a.company;
  if (a?.address_2) row.address2 = a.address_2;
  return row;
}

/** The payments table keeps provider payment IDs (NOWPayments, BitBridge) so later support and refunds can find them. */
function paymentStatus(orderStatus) {
  if (orderStatus === "completed" || orderStatus === "processing") return "paid";
  if (orderStatus === "cancelled") return "cancelled";
  if (orderStatus === "failed") return "failed";
  if (orderStatus === "refunded") return "refunded";
  return "pending";
}

/**
 * A WooCommerce order (wc/v3/orders) with its notes, as rows here. `ctx.productPathById` gives a product's
 * page address (from the catalogue), `ctx.secret` keys the IP hash. Returns the order, its lines, fee lines,
 * coupons used, notes, the provider payment (if any) and `problems` (e.g. totals that don't add up).
 */
export function mapOrder(o, ctx) {
  if (!ORDER_STATUSES.includes(o.status)) throw new Error(`Order ${o.id}: unknown status "${o.status}"`);
  const m = (key) => meta(o.meta_data, key);
  const items = (o.line_items ?? []).map((i) => {
    const quantity = Number(i.quantity);
    const lineSubtotal = decimalToMinor(i.subtotal, { empty: 0n });
    const lineTotal = decimalToMinor(i.total, { empty: 0n });
    // The options WooCommerce shows under the name (its formatted meta: display_key, no "_" keys).
    const options = (i.meta_data ?? []).filter((x) => x.display_key && !String(x.key).startsWith("_")).map((x) => ({ label: htmlToText(x.display_key), value: htmlToText(x.display_value ?? x.value) }));
    return {
      legacyWcItemId: i.id,
      legacyWcProductId: i.product_id || null,
      legacyWcVariationId: i.variation_id || null,
      productName: htmlToText(i.name),
      variantLabel: options.length ? options.map((x) => `${x.label}: ${x.value}`).join(", ") : null,
      options: options.length ? options : null,
      productPath: ctx.productPathById?.get(Number(i.product_id)) ?? null,
      quantity,
      unitPriceMinor: quantity > 0 ? (lineSubtotal + BigInt(Math.floor(quantity / 2))) / BigInt(quantity) : lineSubtotal,
      lineSubtotalMinor: lineSubtotal,
      lineDiscountMinor: lineSubtotal - lineTotal,
      lineTotalMinor: lineTotal,
    };
  });
  const fees = (o.fee_lines ?? []).map((f) => ({ legacyWcItemId: f.id, label: htmlToText(f.name), amountMinor: decimalToMinor(f.total, { empty: 0n }) }));
  const shippingLine = (o.shipping_lines ?? [])[0];
  const lat = text(m("_atlas_delivery_latitude"));
  const lng = text(m("_atlas_delivery_longitude"));
  const locationAddress = text(m("_atlas_google_formatted_address"));
  const attribution = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [camel(key), m(`_wc_order_attribution_${key}`)]).filter(([, value]) => value !== undefined && value !== ""));
  const billingEmail = String(o.billing?.email ?? "")
    .trim()
    .toLowerCase();

  const order = {
    legacyWcOrderId: Number(o.id),
    orderNumber: String(o.number ?? o.id),
    orderKey: o.order_key,
    wpCustomerId: Number(o.customer_id) || null,
    status: o.status,
    currency: o.currency || "IDR",
    subtotalMinor: items.reduce((sum, i) => sum + i.lineSubtotalMinor, 0n),
    discountMinor: decimalToMinor(o.discount_total, { empty: 0n }),
    shippingMinor: decimalToMinor(o.shipping_total, { empty: 0n }),
    feesMinor: fees.reduce((sum, f) => sum + f.amountMinor, 0n),
    taxMinor: decimalToMinor(o.total_tax, { empty: 0n }),
    totalMinor: decimalToMinor(o.total, { empty: 0n }),
    billingEmail,
    billing: address(o.billing, { email: billingEmail, phoneCountryCode: text(m("_billing_phone_country_code")) ?? "" }),
    shipping: o.shipping && Object.values(o.shipping).some(Boolean) ? address(o.shipping) : null,
    shippingMethod: shippingLine ? `${shippingLine.method_id}:${shippingLine.instance_id}` : null,
    shippingMethodTitle: text(shippingLine?.method_title),
    paymentMethod: o.payment_method ?? "",
    paymentMethodTitle: o.payment_method_title ?? "",
    customerNote: text(String(o.customer_note ?? "").trim()),
    deliveryDay: text(m("_delivery_day")),
    deliveryTimeSlot: text(m("_delivery_time_slot")),
    deliveryLocation: lat || lng || locationAddress ? { address: locationAddress ?? "", ...(lat ? { lat } : {}), ...(lng ? { lng } : {}) } : null,
    attribution: Object.keys(attribution).length ? attribution : null,
    customerIpHash: hashIp(o.customer_ip_address, ctx.secret),
    customerUserAgent: text(o.customer_user_agent),
    createdVia: o.created_via || "checkout",
    // WooCommerce's _recorded_coupon_usage_counts (wc_update_coupon_usage_counts): counted unless cancelled, failed or a draft.
    couponUsageRecorded: !["cancelled", "failed", "checkout-draft"].includes(o.status),
    paidAt: utcDate(o.date_paid_gmt),
    completedAt: utcDate(o.date_completed_gmt),
    createdAt: utcDate(o.date_created_gmt),
    updatedAt: utcDate(o.date_modified_gmt) ?? utcDate(o.date_created_gmt),
  };

  const coupons = (o.coupon_lines ?? []).map((c) => ({ legacyWcItemId: c.id, code: String(c.code).trim().toLowerCase(), amountMinor: decimalToMinor(c.discount, { empty: 0n }) }));
  const notes = (ctx.notes ?? []).map((n) => ({ legacyWcNoteId: Number(n.id), body: htmlToText(n.note), isCustomerNote: Boolean(n.customer_note), createdAt: utcDate(n.date_created_gmt) ?? order.createdAt }));
  const providerPaymentId = text(o.transaction_id) ?? text(m("_nowpayments_payment_id"));
  const payment = providerPaymentId
    ? {
        method: order.paymentMethod,
        providerPaymentId,
        status: paymentStatus(o.status),
        amountMinor: order.totalMinor,
        currency: order.currency,
        raw: { source: "woocommerce", ...(m("_nowpayments_last_status") ? { nowpaymentsLastStatus: m("_nowpayments_last_status") } : {}) },
        createdAt: order.paidAt ?? order.createdAt,
      }
    : null;

  const problems = [];
  const expected = order.subtotalMinor - order.discountMinor + order.shippingMinor + order.feesMinor + order.taxMinor;
  if (expected !== order.totalMinor) problems.push({ order: order.legacyWcOrderId, problem: "totals", difference: String(order.totalMinor - expected) });
  if (order.discountMinor < 0n || order.totalMinor < 0n) problems.push({ order: order.legacyWcOrderId, problem: "negative amount" });
  return { order, items, fees, coupons, notes, payment, problems };
}

/** A WooCommerce coupon (wc/v3/coupons). Category IDs become slugs through the catalogue. */
export function mapCoupon(c, categorySlugById) {
  if (!COUPON_TYPES.includes(c.discount_type)) throw new Error(`Coupon ${c.id}: unknown type "${c.discount_type}"`);
  const unknownCategoryIds = [];
  const slugs = (ids) =>
    (ids ?? [])
      .map((id) => {
        const slug = categorySlugById.get(Number(id));
        if (!slug) unknownCategoryIds.push(Number(id));
        return slug;
      })
      .filter(Boolean);
  const positive = (value) => {
    const minor = decimalToMinor(value);
    return minor && minor > 0n ? minor : null;
  };
  return {
    legacyWcCouponId: Number(c.id),
    code: String(c.code).trim().toLowerCase(),
    type: c.discount_type,
    amount: String(c.amount ?? "0"),
    description: text(c.description),
    expiresAt: utcDate(c.date_expires_gmt),
    usageLimit: c.usage_limit ?? null,
    usageLimitPerUser: c.usage_limit_per_user ?? null,
    limitUsageToXItems: c.limit_usage_to_x_items ?? null,
    individualUse: Boolean(c.individual_use),
    freeShipping: Boolean(c.free_shipping),
    excludeSaleItems: Boolean(c.exclude_sale_items),
    minimumAmountMinor: positive(c.minimum_amount),
    maximumAmountMinor: positive(c.maximum_amount),
    productIds: (c.product_ids ?? []).map(Number),
    excludedProductIds: (c.excluded_product_ids ?? []).map(Number),
    categorySlugs: slugs(c.product_categories),
    excludedCategorySlugs: slugs(c.excluded_product_categories),
    emailRestrictions: (c.email_restrictions ?? []).map((e) => String(e).trim().toLowerCase()),
    enabled: c.status === "publish",
    usageCount: Number(c.usage_count ?? 0),
    usedBy: (c.used_by ?? []).map(String),
    createdAt: utcDate(c.date_created_gmt) ?? new Date().toISOString(),
    updatedAt: utcDate(c.date_modified_gmt) ?? utcDate(c.date_created_gmt) ?? new Date().toISOString(),
    unknownCategoryIds,
  };
}

/** An AffiliateWP affiliate. `wpUser` is missing when the WordPress user was deleted. */
export function mapAffiliate(a, wpUser) {
  if (!AFFILIATE_STATUSES.includes(a.status)) throw new Error(`Affiliate ${a.affiliate_id}: unknown status "${a.status}"`);
  return {
    legacyAffwpAffiliateId: Number(a.affiliate_id),
    wpUserId: Number(a.user_id) || null,
    usernameSlug: text(wpUser?.username),
    status: a.status,
    rate: text(a.rate),
    rateType: text(a.rate_type),
    flatRateBasis: text(a.flat_rate_basis),
    paymentEmail: text(a.payment_email)?.toLowerCase() ?? null,
    websiteUrl: text(wpUser?.url),
    dateRegistered: utcDate(a.date_registered),
    legacyTotals: { earnings: String(a.earnings ?? "0"), unpaidEarnings: String(a.unpaid_earnings ?? "0"), referrals: Number(a.referrals ?? 0), visits: Number(a.visits ?? 0) },
  };
}

export function mapReferral(r) {
  if (!REFERRAL_STATUSES.includes(r.status)) throw new Error(`Referral ${r.referral_id}: unknown status "${r.status}"`);
  return {
    legacyAffwpReferralId: Number(r.referral_id),
    affiliateLegacyId: Number(r.affiliate_id),
    visitLegacyId: Number(r.visit_id) || null,
    customerLegacyId: Number(r.customer_id) || null,
    parentLegacyId: Number(r.parent_id) || null,
    payoutLegacyId: Number(r.payout_id) || null,
    amountMinor: decimalToMinor(r.amount, { empty: 0n }),
    currency: text(r.currency)?.toUpperCase() ?? "IDR",
    status: r.status,
    description: text(r.description),
    reference: text(r.reference),
    /** WooCommerce referrals point to an order by its ID. */
    orderLegacyId: r.context === "woocommerce" && /^\d+$/.test(String(r.reference ?? "")) ? Number(r.reference) : null,
    context: text(r.context),
    campaign: text(r.campaign),
    type: text(r.type) ?? "sale",
    flag: text(r.flag),
    products: r.products ?? null,
    custom: r.custom === null || r.custom === undefined || r.custom === "" ? null : typeof r.custom === "string" ? r.custom : JSON.stringify(r.custom),
    createdAt: utcDate(r.date) ?? new Date().toISOString(),
  };
}

/** The ledger entries a referral starts with (see src/db/schema/affiliate.ts, affiliateCommissions). */
export function commissionEntries(referral) {
  const earn = { entryType: "earn", amountMinor: referral.amountMinor, reason: "Imported from AffiliateWP." };
  if (referral.status === "unpaid" || referral.status === "paid") return [earn];
  if (referral.status === "rejected") return [earn, { entryType: "reversal", amountMinor: -referral.amountMinor, reason: "Rejected in AffiliateWP." }];
  return [];
}

export function mapVisit(v, secret) {
  return {
    legacyAffwpVisitId: Number(v.visit_id),
    affiliateLegacyId: Number(v.affiliate_id),
    referralLegacyId: Number(v.referral_id) || null,
    url: text(v.url),
    referrer: text(v.referrer),
    campaign: text(v.campaign),
    context: text(v.context),
    flag: text(v.flag),
    ipHash: hashIp(v.ip, secret),
    landedAt: utcDate(v.date) ?? new Date().toISOString(),
  };
}

export function mapAffiliateCustomer(c, secret) {
  return {
    legacyAffwpCustomerId: Number(c.customer_id),
    wpUserId: Number(c.user_id) || null,
    email: text(c.email)?.toLowerCase() ?? null,
    firstName: text(c.first_name),
    lastName: text(c.last_name),
    ipHash: hashIp(c.ip, secret),
    createdAt: utcDate(c.date_created) ?? new Date().toISOString(),
  };
}

/**
 * What the database must hold after the import, counted from the export file with the same mapping (counts
 * and sums only). `liveTotals` are counted on live independently (WordPress's X-WP-Total, AffiliateWP's own
 * counters) and show whether the export itself is complete.
 */
export function countExport(data) {
  const customers = new Map((data.customers ?? []).map((c) => [Number(c.id), c]));
  const users = (data.users ?? []).map((u) => mapUser(u, customers.get(Number(u.id)))).filter(Boolean);
  const userIds = new Set(users.map((u) => u.legacyWpUserId));
  const tally = (rows, key, amount) => {
    const out = {};
    for (const row of rows) {
      const k = row[key];
      out[k] ??= { n: 0, ...(amount ? { sum: 0n } : {}) };
      out[k].n++;
      if (amount) out[k].sum += amount(row);
    }
    return out;
  };
  const orders = data.orders ?? [];
  const ordersByStatus = Object.fromEntries(Object.entries(tally(orders, "status", (o) => decimalToMinor(o.total, { empty: 0n }))).map(([k, v]) => [k, { n: v.n, totalMinor: String(v.sum) }]));
  const affwp = data.affiliateWp ?? {};
  const referrals = affwp.referrals ?? [];
  const referralsByStatus = Object.fromEntries(Object.entries(tally(referrals, "status", (r) => decimalToMinor(r.amount, { empty: 0n }))).map(([k, v]) => [k, { n: v.n, amountMinor: String(v.sum) }]));
  const referralIds = new Set(referrals.map((r) => Number(r.referral_id)));
  const sumOf = (rows, pick) => rows.reduce((sum, row) => sum + pick(row), 0n);
  return {
    users: users.length,
    usersByRole: Object.fromEntries(Object.entries(tally(users, "role")).map(([k, v]) => [k, v.n])),
    temporaryPasswords: users.filter((u) => u.temporaryPassword).length,
    addresses: [...customers.values()].filter((c) => userIds.has(Number(c.id))).reduce((sum, c) => sum + mapAddresses(c).length, 0),
    orders: orders.length,
    ordersByStatus,
    orderLines: orders.reduce((sum, o) => sum + (o.line_items ?? []).length, 0),
    feeLines: orders.reduce((sum, o) => sum + (o.fee_lines ?? []).length, 0),
    couponLines: orders.reduce((sum, o) => sum + new Set((o.coupon_lines ?? []).map((c) => String(c.code).trim().toLowerCase())).size, 0),
    orderNotes: orders.reduce((sum, o) => sum + (data.orderNotes?.[o.id] ?? []).length, 0),
    coupons: (data.coupons ?? []).length,
    couponUsage: (data.coupons ?? []).reduce((sum, c) => sum + Number(c.usage_count ?? 0), 0),
    affiliates: (affwp.affiliates ?? []).length,
    affiliatesByStatus: Object.fromEntries(Object.entries(tally(affwp.affiliates ?? [], "status")).map(([k, v]) => [k, v.n])),
    referrals: referrals.length,
    referralsByStatus,
    referralEarningsMinor: String(sumOf(referrals.filter((r) => r.status === "unpaid" || r.status === "paid"), (r) => decimalToMinor(r.amount, { empty: 0n }))),
    visits: (affwp.visits ?? []).length,
    visitsConverted: (affwp.visits ?? []).filter((v) => referralIds.has(Number(v.referral_id))).length,
    affiliateCustomers: (affwp.customers ?? []).length,
    payouts: (affwp.payouts ?? []).length,
    affiliateWpCounters: {
      earningsMinor: String(sumOf(affwp.affiliates ?? [], (a) => decimalToMinor(a.earnings, { empty: 0n }))),
      unpaidEarningsMinor: String(sumOf(affwp.affiliates ?? [], (a) => decimalToMinor(a.unpaid_earnings, { empty: 0n }))),
      referrals: (affwp.affiliates ?? []).reduce((sum, a) => sum + Number(a.referrals ?? 0), 0),
      visits: (affwp.affiliates ?? []).reduce((sum, a) => sum + Number(a.visits ?? 0), 0),
    },
  };
}

export function mapPayout(p) {
  return {
    legacyAffwpPayoutId: Number(p.payout_id),
    affiliateLegacyId: Number(p.affiliate_id),
    amountMinor: decimalToMinor(p.amount, { empty: 0n }),
    method: text(p.payout_method),
    status: ["processing", "paid", "failed"].includes(p.status) ? p.status : "processing",
    referralLegacyIds: String(p.referrals ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => id > 0),
    createdAt: utcDate(p.date) ?? new Date().toISOString(),
  };
}
