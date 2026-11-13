/**
 * Rewards / loyalty tables (Phase 6b), replacing RewardsWP Pro 1.7.1 (switched off on live). The rules are
 * the ones on /rewards/ and /rewards-terms/ (src/lib/loyalty/rules.ts); the design is in
 * docs/architecture/database-schema.md §4.
 *
 *   loyalty_members       who joined (one per account) and their referral code, the code in `/share/<code>/`
 *   loyalty_transactions  the credits ledger: append-only, the balance is the SUM of `credits`; a correction
 *                         is a new row, never an edit
 *   loyalty_referrals     "refer a friend": the friend's coupon, the order that qualified, the referrer's reward
 *
 * Rewards that are money off (redeemed credits, the friend's Rp 250,000, the referrer's Rp 250,000) are
 * ordinary rows of `coupons` (source rewards_redemption / rewards_referral), so the cart and checkout
 * treat them like every other coupon (one per order, single use, e-mail restricted).
 */
import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { orders } from "./commerce";

/** earn: credits for a completed order or the welcome credits; redeem: credits spent on a coupon; reverse: an order's credits taken back; restore/adjust: a correction; migration: balances imported from RewardsWP. */
export const loyaltyTransactionType = pgEnum("loyalty_transaction_type", ["earn", "redeem", "reverse", "restore", "adjust", "migration"]);
/** pending: the friend has their coupon; rewarded: the friend's order completed and the referrer has theirs; reversed: that order was refunded or cancelled; rejected: not allowed (self-referral, affiliate order). */
export const loyaltyReferralStatus = pgEnum("loyalty_referral_status", ["pending", "rewarded", "reversed", "rejected"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const loyaltyMembers = pgTable(
  "loyalty_members",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The code in the member's share link (/share/<code>/). Imported members keep RewardsWP's, so links already shared still work. */
    referralCode: text("referral_code").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    /** RewardsWP's member ID, for reconciliation. */
    legacyRewardswpMemberId: integer("legacy_rewardswp_member_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loyalty_members_referral_code_key").on(sql`lower(${table.referralCode})`),
    uniqueIndex("loyalty_members_legacy_rewardswp_member_id_key").on(table.legacyRewardswpMemberId),
  ],
);

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: loyaltyTransactionType("type").notNull(),
    /** Positive adds, negative takes away. The balance is the sum. */
    credits: integer("credits").notNull(),
    /** Where it came from: welcome, order, redemption, import, admin. */
    source: text("source").notNull(),
    /** The order the credits belong to (earn / reverse / migration of a purchase). */
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    /** The coupon a redemption made. */
    couponCode: text("coupon_code"),
    reason: text("reason"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("loyalty_transactions_user_idx").on(table.userId, table.createdAt),
    index("loyalty_transactions_order_idx").on(table.orderId),
    // The welcome credits are given once per member, even when two requests arrive together.
    uniqueIndex("loyalty_transactions_welcome_key").on(table.userId).where(sql`${table.source} = 'welcome'`),
  ],
);

export const loyaltyReferrals = pgTable(
  "loyalty_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The friend, once they have claimed their coupon (RewardsWP's pending referral only knows an e-mail address). */
    referredUserId: text("referred_user_id").references(() => users.id, { onDelete: "set null" }),
    referredEmail: text("referred_email"),
    status: loyaltyReferralStatus("status").notNull().default("pending"),
    /** The friend's Rp 250,000 coupon and the referrer's reward coupon (codes in `coupons`). */
    friendCouponCode: text("friend_coupon_code"),
    rewardCouponCode: text("reward_coupon_code"),
    /** The friend's order that qualified (completed, paid with the friend's coupon). */
    referredOrderId: uuid("referred_order_id").references(() => orders.id, { onDelete: "set null" }),
    note: text("note"),
    legacyRewardswpReferralId: integer("legacy_rewardswp_referral_id"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("loyalty_referrals_referrer_idx").on(table.referrerUserId),
    index("loyalty_referrals_order_idx").on(table.referredOrderId),
    // A friend can claim the welcome coupon of one referral only.
    uniqueIndex("loyalty_referrals_referred_user_key").on(table.referredUserId).where(sql`${table.referredUserId} IS NOT NULL`),
    uniqueIndex("loyalty_referrals_friend_coupon_key").on(sql`lower(${table.friendCouponCode})`).where(sql`${table.friendCouponCode} IS NOT NULL`),
    uniqueIndex("loyalty_referrals_legacy_rewardswp_referral_id_key").on(table.legacyRewardswpReferralId),
  ],
);
