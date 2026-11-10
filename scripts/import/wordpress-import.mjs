/**
 * Writes a WordPress export (scripts/import/export-wordpress.browser.js) into this project's database, in one
 * transaction: accounts and addresses, coupons, orders with their lines, fees, coupons used, notes and provider
 * payments, then AffiliateWP's affiliates, customers, visits, referrals (with their ledger entries) and payouts,
 * and the programme's settings. Every row is found again by its WordPress ID, so running the import a second
 * time (for example just before launch, to bring in the newest orders) updates instead of doubling.
 *
 * Nothing personal is printed or logged: the summary and migration_logs hold counts and WordPress IDs only.
 *
 * `db.run(fn)` runs `fn(query)` in a transaction, `query(text, params)` returns rows (see openDatabase in
 * import-wordpress.mjs). Amounts go in as text and are cast, so postgres.js and PGlite behave the same.
 */
import {
  AFFILIATE_SETTINGS,
  AFFILIATE_SETTINGS_SOURCE,
  EXPORT_VERSION,
  commissionEntries,
  countExport,
  mapAddresses,
  mapAffiliate,
  mapAffiliateCustomer,
  mapCoupon,
  mapOrder,
  mapPayout,
  mapReferral,
  mapUser,
  mapVisit,
  newUserId,
} from "./wordpress-mapping.mjs";

const json = (value) => (value === null || value === undefined ? null : JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const str = (value) => (value === null || value === undefined ? null : String(value));
/** text[] / integer[] parameters go in as JSON, which both drivers pass the same way. */
const TEXT_ARRAY = (n) => `(SELECT coalesce(array_agg(x), '{}'::text[]) FROM jsonb_array_elements_text($${n}::text::jsonb) AS x)`;
const INT_ARRAY = (n) => `(SELECT coalesce(array_agg(x::integer), '{}'::integer[]) FROM jsonb_array_elements_text($${n}::text::jsonb) AS x)`;

/** Builds the lookups the mapping needs from the catalogue snapshot (src/content/catalog.json). */
export function catalogLookups(catalog) {
  return {
    productPathById: new Map((catalog?.products ?? []).map((p) => [Number(p.id), p.path])),
    categorySlugById: new Map((catalog?.categories ?? []).map((c) => [Number(c.id), c.slug])),
  };
}

export async function importWordpress(data, db, { secret, catalog, runId = `wordpress-${new Date().toISOString()}` }) {
  if (data?.version !== EXPORT_VERSION) throw new Error(`This import reads export version ${EXPORT_VERSION}; the file says ${data?.version}.`);
  if (!secret) throw new Error("BETTER_AUTH_SECRET is needed (it keys the IP hashes).");
  const { productPathById, categorySlugById } = catalogLookups(catalog);
  const summary = {};
  const problems = [];

  await db.run(async (q) => {
    const step = async (name, source, imported, skipped, errors) => {
      summary[name] = { source, imported, skipped };
      await q("INSERT INTO migration_logs (run_id, step, source_count, imported_count, skipped_count, errors, finished_at) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, now())", [
        runId,
        name,
        source,
        imported,
        skipped,
        errors.length ? json(errors) : null,
      ]);
    };
    const remember = (entityType, legacyId, newId) =>
      q("INSERT INTO legacy_id_mappings (entity_type, legacy_id, new_id) VALUES ($1, $2, $3) ON CONFLICT (entity_type, legacy_id) DO UPDATE SET new_id = excluded.new_id", [entityType, String(legacyId), String(newId)]);

    // 1. Accounts. A WordPress user with an e-mail already used by an account made here is linked to it.
    const customersById = new Map((data.customers ?? []).map((c) => [Number(c.id), c]));
    const userIdByWpId = new Map();
    const userErrors = [];
    let usersImported = 0;
    for (const wpUser of data.users ?? []) {
      const user = mapUser(wpUser, customersById.get(Number(wpUser.id)));
      if (!user) {
        userErrors.push({ wpUserId: wpUser.id, problem: "no e-mail" });
        continue;
      }
      const [sameEmail] = await q("SELECT id, legacy_wp_user_id FROM users WHERE lower(email) = $1", [user.email]);
      if (sameEmail && sameEmail.legacy_wp_user_id !== null && Number(sameEmail.legacy_wp_user_id) !== user.legacyWpUserId) {
        userErrors.push({ wpUserId: user.legacyWpUserId, problem: "e-mail belongs to another imported user" });
        continue;
      }
      const [sameUsername] = user.username ? await q("SELECT id FROM users WHERE username = $1 AND legacy_wp_user_id IS DISTINCT FROM $2", [user.username, user.legacyWpUserId]) : [];
      if (sameUsername && sameUsername.id !== sameEmail?.id) {
        userErrors.push({ wpUserId: user.legacyWpUserId, problem: "user name taken here; imported without it" });
        user.username = null;
        user.displayUsername = null;
      }
      const values = [user.name, user.email, user.username, user.displayUsername, user.legacyWpUserId, user.firstName, user.lastName, user.role];
      let id;
      if (sameEmail) {
        id = sameEmail.id;
        await q("UPDATE users SET name = $1, email = $2, username = coalesce($3, username), display_username = coalesce($4, display_username), legacy_wp_user_id = $5, first_name = $6, last_name = $7, role = $8, updated_at = now() WHERE id = $9", [...values, id]);
      } else {
        const [row] = await q(
          `INSERT INTO users (id, name, email, username, display_username, legacy_wp_user_id, first_name, last_name, role, email_verified, temporary_password, created_at, updated_at)
           VALUES ($9, $1, $2, $3, $4, $5, $6, $7, $8, false, $10, $11::timestamp, now())
           ON CONFLICT (legacy_wp_user_id) DO UPDATE SET name = excluded.name, email = excluded.email, username = excluded.username, display_username = excluded.display_username,
             first_name = excluded.first_name, last_name = excluded.last_name, role = excluded.role, updated_at = now()
           RETURNING id`,
          [...values, newUserId(), user.temporaryPassword, user.createdAt],
        );
        id = row.id;
      }
      userIdByWpId.set(user.legacyWpUserId, id);
      await remember("wp_user", user.legacyWpUserId, id);
      usersImported++;
    }
    await step("users", (data.users ?? []).length, usersImported, (data.users ?? []).length - usersImported, userErrors);

    // 2. Saved addresses (WooCommerce customers).
    let addressCount = 0;
    let addressSource = 0;
    for (const customer of data.customers ?? []) {
      const userId = userIdByWpId.get(Number(customer.id));
      const rows = mapAddresses(customer);
      addressSource += rows.length;
      if (!userId) continue;
      for (const a of rows) {
        await q(
          `INSERT INTO addresses (user_id, type, first_name, last_name, company, address_1, address_2, city, state, postcode, country, phone, phone_country_code, email)
           VALUES ($1, $2::address_type, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (user_id, type) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, company = excluded.company, address_1 = excluded.address_1,
             address_2 = excluded.address_2, city = excluded.city, state = excluded.state, postcode = excluded.postcode, country = excluded.country, phone = excluded.phone,
             phone_country_code = excluded.phone_country_code, email = excluded.email, updated_at = now()`,
          [userId, a.type, a.firstName, a.lastName, a.company, a.address1, a.address2, a.city, a.state, a.postcode, a.country, a.phone, a.phoneCountryCode, a.email],
        );
        addressCount++;
      }
    }
    await step("addresses", addressSource, addressCount, addressSource - addressCount, []);

    // 3. Coupons.
    const couponIdByCode = new Map();
    const couponErrors = [];
    for (const raw of data.coupons ?? []) {
      const c = mapCoupon(raw, categorySlugById);
      if (c.unknownCategoryIds.length) couponErrors.push({ wcCouponId: c.legacyWcCouponId, problem: "category not in the catalogue", ids: c.unknownCategoryIds });
      const values = [
        c.legacyWcCouponId,
        c.code,
        c.type,
        c.amount,
        c.description,
        c.expiresAt,
        c.usageLimit,
        c.usageLimitPerUser,
        c.limitUsageToXItems,
        c.individualUse,
        c.freeShipping,
        c.excludeSaleItems,
        str(c.minimumAmountMinor),
        str(c.maximumAmountMinor),
        json(c.productIds),
        json(c.excludedProductIds),
        json(c.categorySlugs),
        json(c.excludedCategorySlugs),
        json(c.emailRestrictions),
        c.enabled,
        c.usageCount,
        json(c.usedBy),
        c.createdAt,
        c.updatedAt,
      ];
      const columns = `legacy_wc_coupon_id = $1, code = $2, type = $3::coupon_type, amount = $4, description = $5, expires_at = $6::timestamptz, usage_limit = $7, usage_limit_per_user = $8,
        limit_usage_to_x_items = $9, individual_use = $10, free_shipping = $11, exclude_sale_items = $12, minimum_amount_minor = $13::bigint, maximum_amount_minor = $14::bigint,
        product_ids = ${INT_ARRAY(15)}, excluded_product_ids = ${INT_ARRAY(16)}, category_slugs = ${TEXT_ARRAY(17)}, excluded_category_slugs = ${TEXT_ARRAY(18)},
        email_restrictions = ${TEXT_ARRAY(19)}, enabled = $20, usage_count = $21, used_by = ${TEXT_ARRAY(22)}, created_at = $23::timestamptz, updated_at = $24::timestamptz`;
      const [existing] = await q("SELECT id FROM coupons WHERE legacy_wc_coupon_id = $1 OR lower(code) = $2 ORDER BY (legacy_wc_coupon_id = $1) DESC NULLS LAST LIMIT 1", [c.legacyWcCouponId, c.code]);
      let id;
      if (existing) {
        id = existing.id;
        await q(`UPDATE coupons SET ${columns} WHERE id = $25`, [...values, id]);
      } else {
        const [row] = await q(
          `INSERT INTO coupons (legacy_wc_coupon_id, code, type, amount, description, expires_at, usage_limit, usage_limit_per_user, limit_usage_to_x_items, individual_use, free_shipping,
             exclude_sale_items, minimum_amount_minor, maximum_amount_minor, product_ids, excluded_product_ids, category_slugs, excluded_category_slugs, email_restrictions, enabled,
             usage_count, used_by, created_at, updated_at)
           VALUES ($1, $2, $3::coupon_type, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13::bigint, $14::bigint, ${INT_ARRAY(15)}, ${INT_ARRAY(16)}, ${TEXT_ARRAY(17)},
             ${TEXT_ARRAY(18)}, ${TEXT_ARRAY(19)}, $20, $21, ${TEXT_ARRAY(22)}, $23::timestamptz, $24::timestamptz)
           RETURNING id`,
          values,
        );
        id = row.id;
      }
      couponIdByCode.set(c.code, id);
      await remember("wc_coupon", c.legacyWcCouponId, id);
    }
    await step("coupons", (data.coupons ?? []).length, couponIdByCode.size, (data.coupons ?? []).length - couponIdByCode.size, couponErrors);

    // 4. Orders, with their lines, fee lines, coupons used, notes and provider payments.
    const orderIdByWcId = new Map();
    const orderErrors = [];
    const counts = { items: 0, fees: 0, coupons: 0, notes: 0, payments: 0 };
    for (const raw of data.orders ?? []) {
      const mapped = mapOrder(raw, { productPathById, secret, notes: data.orderNotes?.[raw.id] ?? [] });
      const { order } = mapped;
      problems.push(...mapped.problems);
      const [sameNumber] = await q("SELECT legacy_wc_order_id FROM orders WHERE order_number = $1::bigint", [order.orderNumber]);
      if (sameNumber && Number(sameNumber.legacy_wc_order_id) !== order.legacyWcOrderId) {
        orderErrors.push({ wcOrderId: order.legacyWcOrderId, problem: "an order made here already has this number" });
        continue;
      }
      const userId = order.wpCustomerId ? (userIdByWpId.get(order.wpCustomerId) ?? null) : null;
      const [row] = await q(
        `INSERT INTO orders (order_number, order_key, legacy_wc_order_id, user_id, status, currency, subtotal_minor, discount_minor, shipping_minor, fees_minor, tax_minor, total_minor,
           billing_email, billing, shipping, shipping_method, shipping_method_title, payment_method, payment_method_title, customer_note, delivery_day, delivery_time_slot,
           delivery_location, attribution, customer_ip_hash, customer_user_agent, created_via, paid_at, completed_at, created_at, updated_at, coupon_usage_recorded)
         VALUES ($1::bigint, $2, $3, $4, $5::order_status, $6, $7::bigint, $8::bigint, $9::bigint, $10::bigint, $11::bigint, $12::bigint, $13, $14::text::jsonb, $15::text::jsonb, $16, $17, $18, $19,
           $20, $21, $22, $23::text::jsonb, $24::text::jsonb, $25, $26, $27, $28::timestamptz, $29::timestamptz, $30::timestamptz, $31::timestamptz, $32)
         ON CONFLICT (legacy_wc_order_id) DO UPDATE SET order_number = excluded.order_number, order_key = excluded.order_key, user_id = excluded.user_id, status = excluded.status,
           currency = excluded.currency, subtotal_minor = excluded.subtotal_minor, discount_minor = excluded.discount_minor, shipping_minor = excluded.shipping_minor,
           fees_minor = excluded.fees_minor, tax_minor = excluded.tax_minor, total_minor = excluded.total_minor, billing_email = excluded.billing_email, billing = excluded.billing,
           shipping = excluded.shipping, shipping_method = excluded.shipping_method, shipping_method_title = excluded.shipping_method_title, payment_method = excluded.payment_method,
           payment_method_title = excluded.payment_method_title, customer_note = excluded.customer_note, delivery_day = excluded.delivery_day,
           delivery_time_slot = excluded.delivery_time_slot, delivery_location = excluded.delivery_location, attribution = excluded.attribution,
           customer_ip_hash = excluded.customer_ip_hash, customer_user_agent = excluded.customer_user_agent, created_via = excluded.created_via, paid_at = excluded.paid_at,
           completed_at = excluded.completed_at, created_at = excluded.created_at, updated_at = excluded.updated_at, coupon_usage_recorded = excluded.coupon_usage_recorded
         RETURNING id`,
        [
          order.orderNumber,
          order.orderKey,
          order.legacyWcOrderId,
          userId,
          order.status,
          order.currency,
          str(order.subtotalMinor),
          str(order.discountMinor),
          str(order.shippingMinor),
          str(order.feesMinor),
          str(order.taxMinor),
          str(order.totalMinor),
          order.billingEmail,
          json(order.billing),
          json(order.shipping),
          order.shippingMethod,
          order.shippingMethodTitle,
          order.paymentMethod,
          order.paymentMethodTitle,
          order.customerNote,
          order.deliveryDay,
          order.deliveryTimeSlot,
          json(order.deliveryLocation),
          json(order.attribution),
          order.customerIpHash,
          order.customerUserAgent,
          order.createdVia,
          order.paidAt,
          order.completedAt,
          order.createdAt,
          order.updatedAt,
          order.couponUsageRecorded,
        ],
      );
      const orderId = row.id;
      orderIdByWcId.set(order.legacyWcOrderId, orderId);
      await remember("wc_order", order.legacyWcOrderId, orderId);
      // Lines, fees, coupons used and the payment are only ever written by this import: replace them.
      for (const table of ["order_items", "order_fees", "coupon_redemptions", "payments"]) await q(`DELETE FROM ${table} WHERE order_id = $1`, [orderId]);
      for (const i of mapped.items) {
        await q(
          `INSERT INTO order_items (order_id, legacy_wc_product_id, legacy_wc_variation_id, product_name, variant_label, options, product_path, quantity, unit_price_minor,
             line_subtotal_minor, line_discount_minor, line_total_minor)
           VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8, $9::bigint, $10::bigint, $11::bigint, $12::bigint)`,
          [orderId, i.legacyWcProductId, i.legacyWcVariationId, i.productName, i.variantLabel, json(i.options), i.productPath, i.quantity, str(i.unitPriceMinor), str(i.lineSubtotalMinor), str(i.lineDiscountMinor), str(i.lineTotalMinor)],
        );
        counts.items++;
      }
      for (const f of mapped.fees) {
        await q("INSERT INTO order_fees (order_id, label, amount_minor) VALUES ($1, $2, $3::bigint)", [orderId, f.label, str(f.amountMinor)]);
        counts.fees++;
      }
      for (const c of mapped.coupons) {
        await q(
          `INSERT INTO coupon_redemptions (coupon_id, code, order_id, user_id, email, amount_minor, created_at) VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::timestamptz)
           ON CONFLICT (code, order_id) DO UPDATE SET amount_minor = coupon_redemptions.amount_minor + excluded.amount_minor`,
          [couponIdByCode.get(c.code) ?? null, c.code, orderId, userId, order.billingEmail, str(c.amountMinor), order.createdAt],
        );
        counts.coupons++;
      }
      for (const n of mapped.notes) {
        await q(
          `INSERT INTO order_notes (order_id, is_customer_note, body, legacy_wc_note_id, created_at) VALUES ($1, $2, $3, $4, $5::timestamptz)
           ON CONFLICT (legacy_wc_note_id) DO UPDATE SET order_id = excluded.order_id, is_customer_note = excluded.is_customer_note, body = excluded.body, created_at = excluded.created_at`,
          [orderId, n.isCustomerNote, n.body, n.legacyWcNoteId, n.createdAt],
        );
        counts.notes++;
      }
      if (mapped.payment) {
        const p = mapped.payment;
        await q(
          `INSERT INTO payments (order_id, method, provider_payment_id, status, amount_minor, currency, raw, created_at, updated_at)
           VALUES ($1, $2, $3, $4::payment_status, $5::bigint, $6, $7::text::jsonb, $8::timestamptz, $8::timestamptz)`,
          [orderId, p.method, p.providerPaymentId, p.status, str(p.amountMinor), p.currency, json(p.raw), p.createdAt],
        );
        counts.payments++;
      }
    }
    // New orders count on from the highest WooCommerce number (as the orders table's comment says).
    await q("SELECT setval(pg_get_serial_sequence('orders', 'order_number'), GREATEST((SELECT max(order_number) FROM orders), 1))");
    const orderSource = (data.orders ?? []).length;
    await step("orders", orderSource, orderIdByWcId.size, orderSource - orderIdByWcId.size, orderErrors);
    for (const [name, n] of Object.entries(counts)) await step(`order_${name}`, n, n, 0, []);

    // 5. AffiliateWP.
    const affwp = data.affiliateWp ?? {};
    const wpUsersById = new Map((data.users ?? []).map((u) => [Number(u.id), u]));
    const affiliateIdByLegacy = new Map();
    const affiliateErrors = [];
    for (const raw of affwp.affiliates ?? []) {
      const a = mapAffiliate(raw, wpUsersById.get(Number(raw.user_id)));
      const userId = a.wpUserId ? (userIdByWpId.get(a.wpUserId) ?? null) : null;
      if (a.wpUserId && !userId) affiliateErrors.push({ affiliateId: a.legacyAffwpAffiliateId, problem: "its WordPress user no longer exists; imported without an account" });
      const [row] = await q(
        `INSERT INTO affiliates (legacy_affwp_affiliate_id, user_id, username_slug, status, rate, rate_type, flat_rate_basis, payment_email, website_url, date_registered, legacy_totals)
         VALUES ($1, $2, $3, $4::affiliate_status, $5, $6, $7, $8, $9, $10::timestamptz, $11::text::jsonb)
         ON CONFLICT (legacy_affwp_affiliate_id) DO UPDATE SET user_id = excluded.user_id, username_slug = excluded.username_slug, status = excluded.status, rate = excluded.rate,
           rate_type = excluded.rate_type, flat_rate_basis = excluded.flat_rate_basis, payment_email = excluded.payment_email, website_url = excluded.website_url,
           date_registered = excluded.date_registered, legacy_totals = excluded.legacy_totals, updated_at = now()
         RETURNING id`,
        [a.legacyAffwpAffiliateId, userId, a.usernameSlug, a.status, a.rate, a.rateType, a.flatRateBasis, a.paymentEmail, a.websiteUrl, a.dateRegistered, json(a.legacyTotals)],
      );
      affiliateIdByLegacy.set(a.legacyAffwpAffiliateId, row.id);
      await remember("affwp_affiliate", a.legacyAffwpAffiliateId, row.id);
    }
    await step("affiliates", (affwp.affiliates ?? []).length, affiliateIdByLegacy.size, (affwp.affiliates ?? []).length - affiliateIdByLegacy.size, affiliateErrors);

    for (const [key, value] of Object.entries(AFFILIATE_SETTINGS)) {
      await q("INSERT INTO affiliate_settings (key, value, source, updated_at) VALUES ($1, $2::text::jsonb, $3, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, source = excluded.source, updated_at = now()", [key, JSON.stringify(value), AFFILIATE_SETTINGS_SOURCE]);
    }
    await step("affiliate_settings", Object.keys(AFFILIATE_SETTINGS).length, Object.keys(AFFILIATE_SETTINGS).length, 0, []);

    const customerIdByLegacy = new Map();
    for (const raw of affwp.customers ?? []) {
      const c = mapAffiliateCustomer(raw, secret);
      const [row] = await q(
        `INSERT INTO affiliate_customers (legacy_affwp_customer_id, user_id, email, first_name, last_name, ip_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
         ON CONFLICT (legacy_affwp_customer_id) DO UPDATE SET user_id = excluded.user_id, email = excluded.email, first_name = excluded.first_name, last_name = excluded.last_name,
           ip_hash = excluded.ip_hash, created_at = excluded.created_at
         RETURNING id`,
        [c.legacyAffwpCustomerId, c.wpUserId ? (userIdByWpId.get(c.wpUserId) ?? null) : null, c.email, c.firstName, c.lastName, c.ipHash, c.createdAt],
      );
      customerIdByLegacy.set(c.legacyAffwpCustomerId, row.id);
      await remember("affwp_customer", c.legacyAffwpCustomerId, row.id);
    }
    await step("affiliate_customers", (affwp.customers ?? []).length, customerIdByLegacy.size, (affwp.customers ?? []).length - customerIdByLegacy.size, []);

    const visitErrors = [];
    const visitIdByLegacy = new Map();
    const visits = (affwp.visits ?? []).map((v) => mapVisit(v, secret));
    for (const v of visits) {
      const affiliateId = affiliateIdByLegacy.get(v.affiliateLegacyId);
      if (!affiliateId) {
        visitErrors.push({ visitId: v.legacyAffwpVisitId, problem: "affiliate not imported" });
        continue;
      }
      const [row] = await q(
        `INSERT INTO affiliate_visits (legacy_affwp_visit_id, affiliate_id, url, referrer, campaign, context, flag, ip_hash, landed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
         ON CONFLICT (legacy_affwp_visit_id) DO UPDATE SET affiliate_id = excluded.affiliate_id, url = excluded.url, referrer = excluded.referrer, campaign = excluded.campaign,
           context = excluded.context, flag = excluded.flag, ip_hash = excluded.ip_hash, landed_at = excluded.landed_at
         RETURNING id`,
        [v.legacyAffwpVisitId, affiliateId, v.url, v.referrer, v.campaign, v.context, v.flag, v.ipHash, v.landedAt],
      );
      visitIdByLegacy.set(v.legacyAffwpVisitId, row.id);
      await remember("affwp_visit", v.legacyAffwpVisitId, row.id);
    }
    await step("affiliate_visits", visits.length, visitIdByLegacy.size, visits.length - visitIdByLegacy.size, visitErrors);

    const payouts = (affwp.payouts ?? []).map(mapPayout);
    const payoutIdByLegacy = new Map();
    for (const p of payouts) {
      const affiliateId = affiliateIdByLegacy.get(p.affiliateLegacyId);
      if (!affiliateId) continue;
      const [row] = await q(
        `INSERT INTO affiliate_payouts (legacy_affwp_payout_id, affiliate_id, amount_minor, method, status, paid_at, created_at) VALUES ($1, $2, $3::bigint, $4, $5::affiliate_payout_status, $6::timestamptz, $6::timestamptz)
         ON CONFLICT (legacy_affwp_payout_id) DO UPDATE SET affiliate_id = excluded.affiliate_id, amount_minor = excluded.amount_minor, method = excluded.method, status = excluded.status, paid_at = excluded.paid_at
         RETURNING id`,
        [p.legacyAffwpPayoutId, affiliateId, str(p.amountMinor), p.method, p.status, p.createdAt],
      );
      payoutIdByLegacy.set(p.legacyAffwpPayoutId, row.id);
      await remember("affwp_payout", p.legacyAffwpPayoutId, row.id);
    }
    await step("affiliate_payouts", payouts.length, payoutIdByLegacy.size, payouts.length - payoutIdByLegacy.size, []);

    const referralErrors = [];
    const referralIdByLegacy = new Map();
    const referrals = (affwp.referrals ?? []).map(mapReferral);
    let ledgerEntries = 0;
    for (const r of referrals) {
      const affiliateId = affiliateIdByLegacy.get(r.affiliateLegacyId);
      if (!affiliateId) {
        referralErrors.push({ referralId: r.legacyAffwpReferralId, problem: "affiliate not imported" });
        continue;
      }
      const orderId = r.orderLegacyId ? (orderIdByWcId.get(r.orderLegacyId) ?? null) : null;
      if (r.orderLegacyId && !orderId) referralErrors.push({ referralId: r.legacyAffwpReferralId, problem: "its order no longer exists in WooCommerce; kept with the reference only" });
      const [row] = await q(
        `INSERT INTO affiliate_referrals (legacy_affwp_referral_id, affiliate_id, order_id, visit_id, affiliate_customer_id, payout_id, amount_minor, currency, status, description, reference,
           context, campaign, type, flag, products, custom, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::bigint, $8, $9::affiliate_referral_status, $10, $11, $12, $13, $14, $15, $16::text::jsonb, $17, $18::timestamptz, $18::timestamptz)
         ON CONFLICT (legacy_affwp_referral_id) DO UPDATE SET affiliate_id = excluded.affiliate_id, order_id = excluded.order_id, visit_id = excluded.visit_id,
           affiliate_customer_id = excluded.affiliate_customer_id, payout_id = excluded.payout_id, amount_minor = excluded.amount_minor, currency = excluded.currency,
           status = excluded.status, description = excluded.description, reference = excluded.reference, context = excluded.context, campaign = excluded.campaign,
           type = excluded.type, flag = excluded.flag, products = excluded.products, custom = excluded.custom, created_at = excluded.created_at, updated_at = now()
         RETURNING id`,
        [
          r.legacyAffwpReferralId,
          affiliateId,
          orderId,
          r.visitLegacyId ? (visitIdByLegacy.get(r.visitLegacyId) ?? null) : null,
          r.customerLegacyId ? (customerIdByLegacy.get(r.customerLegacyId) ?? null) : null,
          r.payoutLegacyId ? (payoutIdByLegacy.get(r.payoutLegacyId) ?? null) : null,
          str(r.amountMinor),
          r.currency,
          r.status,
          r.description,
          r.reference,
          r.context,
          r.campaign,
          r.type,
          r.flag,
          json(r.products),
          r.custom,
          r.createdAt,
        ],
      );
      referralIdByLegacy.set(r.legacyAffwpReferralId, row.id);
      await remember("affwp_referral", r.legacyAffwpReferralId, row.id);
      // The ledger is rebuilt from the imported status (only the import writes entries for these referrals so far).
      await q("DELETE FROM affiliate_commissions WHERE referral_id = $1", [row.id]);
      for (const entry of commissionEntries(r)) {
        await q("INSERT INTO affiliate_commissions (referral_id, entry_type, amount_minor, reason, created_at) VALUES ($1, $2::affiliate_commission_entry, $3::bigint, $4, $5::timestamptz)", [
          row.id,
          entry.entryType,
          str(entry.amountMinor),
          entry.reason,
          r.createdAt,
        ]);
        ledgerEntries++;
      }
    }
    for (const r of referrals) {
      if (!r.parentLegacyId || !referralIdByLegacy.has(r.legacyAffwpReferralId)) continue;
      await q("UPDATE affiliate_referrals SET parent_id = $1 WHERE id = $2", [referralIdByLegacy.get(r.parentLegacyId) ?? null, referralIdByLegacy.get(r.legacyAffwpReferralId)]);
    }
    await step("affiliate_referrals", referrals.length, referralIdByLegacy.size, referrals.length - referralIdByLegacy.size, referralErrors);
    await step("affiliate_commissions", ledgerEntries, ledgerEntries, 0, []);

    for (const v of visits) {
      const visitId = visitIdByLegacy.get(v.legacyAffwpVisitId);
      if (visitId) await q("UPDATE affiliate_visits SET referral_id = $1 WHERE id = $2", [v.referralLegacyId ? (referralIdByLegacy.get(v.referralLegacyId) ?? null) : null, visitId]);
    }
    for (const p of payouts) {
      const payoutId = payoutIdByLegacy.get(p.legacyAffwpPayoutId);
      if (!payoutId) continue;
      for (const legacy of p.referralLegacyIds) {
        const referralId = referralIdByLegacy.get(legacy);
        if (referralId) await q("INSERT INTO affiliate_payout_items (payout_id, referral_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [payoutId, referralId]);
      }
    }
  });

  return { summary, problems };
}

/**
 * Compares the export's own counts (made in the browser from the live data) with what the database holds
 * now. Every line must match before launch (docs/audit/affiliatewp-audit.md §7). Counts and sums only.
 */
export async function reconcile(data, query) {
  const one = async (sql, params = []) => (await query(sql, params))[0];
  const live = countExport(data);
  const rows = [];
  const add = (what, expected, actual) => rows.push({ what, live: String(expected ?? "—"), here: String(actual ?? "—"), ok: String(expected) === String(actual) });

  // Is the export complete? Totals counted on live on their own (X-WP-Total, AffiliateWP's counters).
  const totals = data.liveTotals ?? {};
  if (totals.users !== undefined) add("Export complete: users (X-WP-Total)", totals.users, (data.users ?? []).length);
  if (totals.orders !== undefined) add("Export complete: orders (X-WP-Total)", totals.orders, (data.orders ?? []).length);
  if (totals.coupons !== undefined) add("Export complete: coupons (X-WP-Total)", totals.coupons, (data.coupons ?? []).length);
  if (totals.ordersWithNotesFetched !== undefined) add("Export complete: orders whose notes were read", totals.ordersWithNotesFetched, (data.orders ?? []).length);
  add("AffiliateWP's counter: paid earnings", live.affiliateWpCounters.earningsMinor, live.referralsByStatus.paid?.amountMinor ?? "0");
  add("AffiliateWP's counter: unpaid earnings", live.affiliateWpCounters.unpaidEarningsMinor, live.referralsByStatus.unpaid?.amountMinor ?? "0");

  add("WordPress users", live.users, (await one("SELECT count(*)::int AS n FROM users WHERE legacy_wp_user_id IS NOT NULL")).n);
  for (const role of Object.keys(live.usersByRole ?? {})) add(`  role ${role}`, live.usersByRole[role], (await one("SELECT count(*)::int AS n FROM users WHERE legacy_wp_user_id IS NOT NULL AND role = $1", [role])).n);
  add("  temporary-password reminder", live.temporaryPasswords, (await one("SELECT count(*)::int AS n FROM users WHERE legacy_wp_user_id IS NOT NULL AND temporary_password")).n);
  add("Saved addresses", live.addresses, (await one("SELECT count(*)::int AS n FROM addresses a JOIN users u ON u.id = a.user_id WHERE u.legacy_wp_user_id IS NOT NULL")).n);
  add("Orders", live.orders, (await one("SELECT count(*)::int AS n FROM orders WHERE legacy_wc_order_id IS NOT NULL")).n);
  for (const [status, s] of Object.entries(live.ordersByStatus ?? {})) {
    const here = await one("SELECT count(*)::int AS n, coalesce(sum(total_minor), 0)::text AS total FROM orders WHERE legacy_wc_order_id IS NOT NULL AND status = $1::order_status", [status]);
    add(`  ${status}: count`, s.n, here.n);
    add(`  ${status}: total (minor units)`, s.totalMinor, here.total);
  }
  add("Order lines", live.orderLines, (await one("SELECT count(*)::int AS n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.legacy_wc_order_id IS NOT NULL")).n);
  add("Fee lines", live.feeLines, (await one("SELECT count(*)::int AS n FROM order_fees f JOIN orders o ON o.id = f.order_id WHERE o.legacy_wc_order_id IS NOT NULL")).n);
  add("Coupon lines on orders", live.couponLines, (await one("SELECT count(*)::int AS n FROM coupon_redemptions r JOIN orders o ON o.id = r.order_id WHERE o.legacy_wc_order_id IS NOT NULL")).n);
  add("Order notes", live.orderNotes, (await one("SELECT count(*)::int AS n FROM order_notes WHERE legacy_wc_note_id IS NOT NULL")).n);
  add("Coupons", live.coupons, (await one("SELECT count(*)::int AS n FROM coupons WHERE legacy_wc_coupon_id IS NOT NULL")).n);
  add("  times used (usage_count)", live.couponUsage, (await one("SELECT coalesce(sum(usage_count), 0)::int AS n FROM coupons WHERE legacy_wc_coupon_id IS NOT NULL")).n);
  add("Affiliates", live.affiliates, (await one("SELECT count(*)::int AS n FROM affiliates WHERE legacy_affwp_affiliate_id IS NOT NULL")).n);
  for (const [status, n] of Object.entries(live.affiliatesByStatus ?? {})) add(`  ${status}`, n, (await one("SELECT count(*)::int AS n FROM affiliates WHERE status = $1::affiliate_status", [status])).n);
  add("Referrals", live.referrals, (await one("SELECT count(*)::int AS n FROM affiliate_referrals WHERE legacy_affwp_referral_id IS NOT NULL")).n);
  for (const [status, s] of Object.entries(live.referralsByStatus ?? {})) {
    const here = await one("SELECT count(*)::int AS n, coalesce(sum(amount_minor), 0)::text AS total FROM affiliate_referrals WHERE status = $1::affiliate_referral_status", [status]);
    add(`  ${status}: count`, s.n, here.n);
    add(`  ${status}: amount (minor units)`, s.amountMinor, here.total);
  }
  add("  ledger balance (unpaid + paid)", live.referralEarningsMinor, (await one("SELECT coalesce(sum(amount_minor), 0)::text AS total FROM affiliate_commissions")).total);
  add("Visits", live.visits, (await one("SELECT count(*)::int AS n FROM affiliate_visits WHERE legacy_affwp_visit_id IS NOT NULL")).n);
  add("  converted", live.visitsConverted, (await one("SELECT count(*)::int AS n FROM affiliate_visits WHERE legacy_affwp_visit_id IS NOT NULL AND referral_id IS NOT NULL")).n);
  add("AffiliateWP customers", live.affiliateCustomers, (await one("SELECT count(*)::int AS n FROM affiliate_customers WHERE legacy_affwp_customer_id IS NOT NULL")).n);
  add("Payouts", live.payouts, (await one("SELECT count(*)::int AS n FROM affiliate_payouts WHERE legacy_affwp_payout_id IS NOT NULL")).n);
  return rows;
}
