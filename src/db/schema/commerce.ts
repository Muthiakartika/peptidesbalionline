/**
 * Commerce tables (Phase 5): addresses, carts, orders, coupons and payments.
 * See docs/architecture/database-schema.md §2 and the live settings in docs/audit/backend-settings.md.
 *
 * Money: bigint minor units + currency (Rp 1.00 = 100). Order and line amounts are SNAPSHOTS taken when
 * the order is placed, so later price changes never change an order. Users come from Better Auth
 * (auth.ts: text IDs).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { affiliates } from "./affiliate";
import { users } from "./auth";
import { productVariants } from "./catalog";

/** WooCommerce's order statuses; live uses no others (backend-settings.md §6). */
export const orderStatus = pgEnum("order_status", ["checkout-draft", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]);
export const addressType = pgEnum("address_type", ["billing", "shipping"]);
export const couponType = pgEnum("coupon_type", ["percent", "fixed_cart", "fixed_product"]);
/** Where a coupon comes from (affiliate coupons and rewards come in Phase 6). */
export const couponSource = pgEnum("coupon_source", ["manual", "affiliate", "rewards_welcome", "rewards_referral", "rewards_redemption"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "authorized", "paid", "failed", "cancelled", "refunded"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
const money = (name: string) => bigint(name, { mode: "bigint" });

/**
 * A customer's saved billing / shipping address (WooCommerce's My Account → Addresses). Live asks for:
 * full name, WhatsApp number with country code, e-mail, country, street, town/city, province, postcode.
 */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: addressType("type").notNull(),
    /** Live's "Full name" field is WooCommerce's first name; last name is switched off. */
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    address1: text("address_1"),
    address2: text("address_2"),
    city: text("city"),
    state: text("state"),
    postcode: text("postcode"),
    country: char("country", { length: 2 }),
    /** WhatsApp number as typed, and the country code chosen beside it ("ID|+62"). */
    phone: text("phone"),
    phoneCountryCode: text("phone_country_code"),
    email: text("email"),
    ...timestamps,
  },
  (table) => [uniqueIndex("addresses_user_type_key").on(table.userId, table.type)],
);

/** A shopping cart: a guest's (cookie token) or a logged-in customer's. */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The random value in the cart cookie. */
    token: text("token").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Applied coupon codes, in the order they were applied (several can apply: backend-settings.md §1). */
    couponCodes: text("coupon_codes").array().notNull().default(sql`'{}'::text[]`),
    shippingMethod: text("shipping_method"),
    paymentMethod: text("payment_method"),
    /** Who referred the visitor when the cart was made (filled by the affiliate module, Phase 6a). */
    referral: jsonb("referral"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("carts_token_key").on(table.token), index("carts_user_idx").on(table.userId)],
);

/** A cart line. Prices are never stored here: they are read fresh every time. */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cart_items_cart_variant_key").on(table.cartId, table.variantId),
    check("cart_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 9999`),
  ],
);

/** A coupon (WooCommerce's shop_coupon). Codes are stored lower case and unique. */
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyWcCouponId: integer("legacy_wc_coupon_id"),
    code: text("code").notNull(),
    type: couponType("type").notNull(),
    /** As WooCommerce stores it: "10.00" (percent) or "250000.00" (rupiah); see src/lib/commerce/coupons.ts. */
    amount: text("amount").notNull(),
    description: text("description"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    usageLimitPerUser: integer("usage_limit_per_user"),
    limitUsageToXItems: integer("limit_usage_to_x_items"),
    individualUse: boolean("individual_use").notNull().default(false),
    freeShipping: boolean("free_shipping").notNull().default(false),
    excludeSaleItems: boolean("exclude_sale_items").notNull().default(false),
    minimumAmountMinor: money("minimum_amount_minor"),
    maximumAmountMinor: money("maximum_amount_minor"),
    /** WooCommerce product / variation IDs and category slugs. */
    productIds: integer("product_ids").array().notNull().default(sql`'{}'::integer[]`),
    excludedProductIds: integer("excluded_product_ids").array().notNull().default(sql`'{}'::integer[]`),
    categorySlugs: text("category_slugs").array().notNull().default(sql`'{}'::text[]`),
    excludedCategorySlugs: text("excluded_category_slugs").array().notNull().default(sql`'{}'::text[]`),
    emailRestrictions: text("email_restrictions").array().notNull().default(sql`'{}'::text[]`),
    source: couponSource("source").notNull().default("manual"),
    /** The affiliate who owns it (AffiliateWP's affiliate coupons). */
    affiliateId: uuid("affiliate_id").references((): AnyPgColumn => affiliates.id, { onDelete: "set null" }),
    enabled: boolean("enabled").notNull().default(true),
    /**
     * WooCommerce's own counters: how often the coupon was used (usage_count, checked against usageLimit)
     * and by whom (used_by: user IDs or, for guests, billing e-mails; checked against usageLimitPerUser).
     * Imported as they are; coupon_redemptions keeps the per-order history next to them.
     */
    usageCount: integer("usage_count").notNull().default(0),
    usedBy: text("used_by").array().notNull().default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("coupons_code_key").on(sql`lower(${table.code})`),
    uniqueIndex("coupons_legacy_wc_coupon_id_key").on(table.legacyWcCouponId),
  ],
);

/** An order. Every amount and address is a snapshot of the moment it was placed. */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * The number customers see ("Order #12345"). New orders count on from the highest WooCommerce
     * order number: the import sets the sequence past it (setval on orders_order_number_seq).
     */
    orderNumber: bigserial("order_number", { mode: "bigint" }).notNull(),
    /** WooCommerce's order key ("wc_order_…"): the thank-you page's ?key=, so only the buyer sees the order. */
    orderKey: text("order_key").notNull(),
    legacyWcOrderId: integer("legacy_wc_order_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: orderStatus("status").notNull().default("pending"),
    currency: char("currency", { length: 3 }).notNull().default("IDR"),
    subtotalMinor: money("subtotal_minor").notNull(),
    discountMinor: money("discount_minor").notNull().default(sql`0`),
    shippingMinor: money("shipping_minor").notNull().default(sql`0`),
    /** Sum of the fee lines (order_fees: card +5% is positive, a payment discount negative). */
    feesMinor: money("fees_minor").notNull().default(sql`0`),
    taxMinor: money("tax_minor").notNull().default(sql`0`),
    totalMinor: money("total_minor").notNull(),
    billingEmail: text("billing_email").notNull(),
    /** { firstName, lastName, phone, phoneCountryCode, address1, city, state, postcode, country } */
    billing: jsonb("billing").notNull(),
    shipping: jsonb("shipping"),
    shippingMethod: text("shipping_method"),
    shippingMethodTitle: text("shipping_method_title"),
    paymentMethod: text("payment_method").notNull(),
    paymentMethodTitle: text("payment_method_title").notNull(),
    customerNote: text("customer_note"),
    /** Checkout delivery slot (backend-settings.md §4): "2026-11-06" and "09:00-12:00". */
    deliveryDay: text("delivery_day"),
    deliveryTimeSlot: text("delivery_time_slot"),
    /** The pin on the checkout map: { lat, lng, address }. */
    deliveryLocation: jsonb("delivery_location"),
    /** WooCommerce order attribution (source, UTM, device) from the checkout's hidden fields. */
    attribution: jsonb("attribution"),
    customerIpHash: text("customer_ip_hash"),
    customerUserAgent: text("customer_user_agent"),
    createdVia: text("created_via").notNull().default("checkout"),
    /**
     * WooCommerce's _recorded_coupon_usage_counts: whether this order's coupons are counted in their usage
     * (counted when the order is placed, given back when it is cancelled or failed, counted again if it comes back).
     */
    couponUsageRecorded: boolean("coupon_usage_recorded").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_order_number_key").on(table.orderNumber),
    uniqueIndex("orders_order_key_key").on(table.orderKey),
    uniqueIndex("orders_legacy_wc_order_id_key").on(table.legacyWcOrderId),
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_billing_email_idx").on(sql`lower(${table.billingEmail})`),
    check("orders_amounts_not_negative", sql`${table.subtotalMinor} >= 0 AND ${table.discountMinor} >= 0 AND ${table.shippingMinor} >= 0 AND ${table.totalMinor} >= 0`),
  ],
);

/** An order line, with the product's name and price as they were. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    legacyWcProductId: integer("legacy_wc_product_id"),
    legacyWcVariationId: integer("legacy_wc_variation_id"),
    productName: text("product_name").notNull(),
    /** The chosen options, e.g. "Pen type: Disposable pen, MG: 5mg". */
    variantLabel: text("variant_label"),
    /** The same options one by one, as the order pages list them: [{ label: "Pen Type", value: "Disposable Pen" }]. */
    options: jsonb("options").$type<{ label: string; value: string }[]>(),
    /** The product page address when the order was placed (the order pages link the name to it). */
    productPath: text("product_path"),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: money("unit_price_minor").notNull(),
    /** Before coupons. */
    lineSubtotalMinor: money("line_subtotal_minor").notNull(),
    lineDiscountMinor: money("line_discount_minor").notNull().default(sql`0`),
    /** After coupons. */
    lineTotalMinor: money("line_total_minor").notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId), check("order_items_quantity_positive", sql`${table.quantity} > 0`)],
);

/** Fee lines of an order, e.g. "Card adjustment (5%)" (WooCommerce fee items). */
export const orderFees = pgTable(
  "order_fees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amountMinor: money("amount_minor").notNull(),
  },
  (table) => [index("order_fees_order_idx").on(table.orderId)],
);

/** Each coupon used on an order and what it took off (also counts the coupon's usage). */
export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    /** The code as used, kept even if the coupon is deleted later. */
    code: text("code").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    amountMinor: money("amount_minor").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("coupon_redemptions_coupon_order_key").on(table.code, table.orderId),
    index("coupon_redemptions_coupon_idx").on(table.couponId),
    index("coupon_redemptions_email_idx").on(sql`lower(${table.email})`),
  ],
);

/** Order notes (WooCommerce's order notes): internal ones and notes sent to the customer. */
export const orderNotes = pgTable(
  "order_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    isCustomerNote: boolean("is_customer_note").notNull().default(false),
    body: text("body").notNull(),
    /** The WooCommerce note's ID (a comment ID), so importing again updates instead of doubling. */
    legacyWcNoteId: integer("legacy_wc_note_id"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("order_notes_order_idx").on(table.orderId), uniqueIndex("order_notes_legacy_wc_note_id_key").on(table.legacyWcNoteId)],
);

/** A payment for an order: manual (card link, IDR account, Revolut, Wise, COD) or through a provider. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    /** The payment method ID (store-settings.ts), e.g. "atlas_card", "nowpayments_gateway". */
    method: text("method").notNull(),
    providerPaymentId: text("provider_payment_id"),
    status: paymentStatus("status").notNull().default("pending"),
    amountMinor: money("amount_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("IDR"),
    /** Who marked a manual payment as received (admin). */
    confirmedByUserId: text("confirmed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    index("payments_order_idx").on(table.orderId),
    uniqueIndex("payments_provider_payment_key").on(table.method, table.providerPaymentId),
  ],
);

/** Every webhook received from a payment provider, once (the unique key stops duplicates). */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("payment_events_provider_event_key").on(table.provider, table.providerEventId)],
);

/** Money given back on an order (triggers commission and reward reversals in Phase 6). */
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    amountMinor: money("amount_minor").notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    providerRefundId: text("provider_refund_id"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("refunds_order_idx").on(table.orderId), check("refunds_amount_positive", sql`${table.amountMinor} > 0`)],
);
