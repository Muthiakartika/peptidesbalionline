/**
 * Affiliate tables (Phase 6a), replacing AffiliateWP 2.37.4. See docs/architecture/database-schema.md §3 and the
 * live settings in docs/audit/backend-settings.md §9. Filled first by the WordPress import
 * (scripts/import/import-wordpress.mjs); the module's screens and rules come later.
 *
 * Privacy: IP addresses are never stored, only a keyed hash (scripts/import/wordpress-mapping.mjs `hashIp`).
 * Money: bigint minor units, as everywhere (Rp 1.00 = 100).
 */
import { sql } from "drizzle-orm";
import { bigint, char, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { orders } from "./commerce";

/** AffiliateWP's affiliate statuses. */
export const affiliateStatus = pgEnum("affiliate_status", ["active", "inactive", "pending", "rejected"]);
/** AffiliateWP's referral statuses ("draft" is used by its importers). */
export const affiliateReferralStatus = pgEnum("affiliate_referral_status", ["pending", "unpaid", "paid", "rejected", "draft"]);
export const affiliateCommissionEntry = pgEnum("affiliate_commission_entry", ["earn", "reversal", "adjustment"]);
export const affiliatePayoutStatus = pgEnum("affiliate_payout_status", ["processing", "paid", "failed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
const money = (name: string) => bigint(name, { mode: "bigint" });

/**
 * An affiliate. `userId` is empty when the WordPress user behind it was deleted (live has one such
 * affiliate: AffiliateWP keeps the row, but nobody can log in to it).
 */
export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    legacyAffwpAffiliateId: integer("legacy_affwp_affiliate_id"),
    /** The name in referral links (`?ref=<x>`, `/ref/<x>/`): the WordPress user name (live's format is "username"). */
    usernameSlug: text("username_slug"),
    status: affiliateStatus("status").notNull().default("pending"),
    /** Empty = the site's default rate (live: 10%, settings below). AffiliateWP stores these as text. */
    rate: text("rate"),
    rateType: text("rate_type"),
    flatRateBasis: text("flat_rate_basis"),
    paymentEmail: text("payment_email"),
    websiteUrl: text("website_url"),
    promotionMethod: text("promotion_method"),
    dateRegistered: timestamp("date_registered", { withTimezone: true }),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** AffiliateWP's own counters at import time (earnings, unpaid earnings, referrals, visits), for reconciliation. */
    legacyTotals: jsonb("legacy_totals"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("affiliates_legacy_affwp_affiliate_id_key").on(table.legacyAffwpAffiliateId),
    uniqueIndex("affiliates_user_key").on(table.userId).where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("affiliates_username_slug_key").on(sql`lower(${table.usernameSlug})`).where(sql`${table.usernameSlug} IS NOT NULL`),
    index("affiliates_status_idx").on(table.status),
  ],
);

/** The programme's settings, one row per setting (cookie days, rate, credit mode…), copied from AffiliateWP. */
export const affiliateSettings = pgTable("affiliate_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  /** Where the value comes from, e.g. "AffiliateWP settings read in wp-admin, 6 Nov 2026". */
  source: text("source"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** AffiliateWP's customers: the buyers its referrals point to (guests included). */
export const affiliateCustomers = pgTable(
  "affiliate_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyAffwpCustomerId: integer("legacy_affwp_customer_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("affiliate_customers_legacy_key").on(table.legacyAffwpCustomerId), index("affiliate_customers_email_idx").on(sql`lower(${table.email})`)],
);

/** A payout to an affiliate (live has none yet: paid by hand, no payout service). */
export const affiliatePayouts = pgTable(
  "affiliate_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyAffwpPayoutId: integer("legacy_affwp_payout_id"),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "restrict" }),
    amountMinor: money("amount_minor").notNull(),
    method: text("method"),
    status: affiliatePayoutStatus("status").notNull().default("processing"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    reference: text("reference"),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("affiliate_payouts_legacy_key").on(table.legacyAffwpPayoutId), index("affiliate_payouts_affiliate_idx").on(table.affiliateId)],
);

/**
 * A visit through an affiliate link. `referralId` points to the referral it turned into; it has no foreign
 * key because referrals point back to their visit.
 */
export const affiliateVisits = pgTable(
  "affiliate_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyAffwpVisitId: integer("legacy_affwp_visit_id"),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    referralId: uuid("referral_id"),
    url: text("url"),
    referrer: text("referrer"),
    campaign: text("campaign"),
    context: text("context"),
    flag: text("flag"),
    ipHash: text("ip_hash"),
    landedAt: timestamp("landed_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("affiliate_visits_legacy_key").on(table.legacyAffwpVisitId), index("affiliate_visits_affiliate_idx").on(table.affiliateId)],
);

/**
 * A referral: the commission an affiliate earns on one order. `reference` keeps AffiliateWP's own reference
 * (the WooCommerce order ID) even when that order no longer exists (live's one referral points to a
 * deleted order).
 */
export const affiliateReferrals = pgTable(
  "affiliate_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyAffwpReferralId: integer("legacy_affwp_referral_id"),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    visitId: uuid("visit_id").references(() => affiliateVisits.id, { onDelete: "set null" }),
    affiliateCustomerId: uuid("affiliate_customer_id").references(() => affiliateCustomers.id, { onDelete: "set null" }),
    payoutId: uuid("payout_id").references(() => affiliatePayouts.id, { onDelete: "set null" }),
    /** AffiliateWP's parent referral (multi-tier, off on live). */
    parentId: uuid("parent_id"),
    amountMinor: money("amount_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("IDR"),
    status: affiliateReferralStatus("status").notNull().default("pending"),
    description: text("description"),
    reference: text("reference"),
    context: text("context"),
    campaign: text("campaign"),
    type: text("type").notNull().default("sale"),
    flag: text("flag"),
    /** The products the commission was counted on, as AffiliateWP stored them. */
    products: jsonb("products"),
    custom: text("custom"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("affiliate_referrals_legacy_key").on(table.legacyAffwpReferralId),
    uniqueIndex("affiliate_referrals_order_affiliate_key").on(table.orderId, table.affiliateId).where(sql`${table.orderId} IS NOT NULL`),
    index("affiliate_referrals_affiliate_idx").on(table.affiliateId),
    index("affiliate_referrals_status_idx").on(table.status),
  ],
);

/**
 * The commission ledger: an affiliate's balance is the sum of its entries. An unpaid or paid referral has
 * one "earn" entry; a rejected one an "earn" and a "reversal" (so the history shows it); a pending one none
 * yet.
 */
export const affiliateCommissions = pgTable(
  "affiliate_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => affiliateReferrals.id, { onDelete: "cascade" }),
    entryType: affiliateCommissionEntry("entry_type").notNull(),
    amountMinor: money("amount_minor").notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("affiliate_commissions_referral_idx").on(table.referralId)],
);

/** Which referrals a payout paid. A referral can only be paid once. */
export const affiliatePayoutItems = pgTable(
  "affiliate_payout_items",
  {
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => affiliatePayouts.id, { onDelete: "cascade" }),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => affiliateReferrals.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.payoutId, table.referralId] }), uniqueIndex("affiliate_payout_items_referral_key").on(table.referralId)],
);
