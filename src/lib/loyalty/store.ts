/**
 * The rewards programme in the database (server code only). The rules are in ./rules.ts; the tables in
 * src/db/schema/loyalty.ts.
 *
 *   joinRewards          a free account in the programme: the welcome credits, once
 *   claimFriendCoupon    "refer a friend", the friend's side: Rp 250,000 off a first order of Rp 3,000,000+
 *   redeemCredits        250 credits → a Rp 250,000 coupon (the credits leave the ledger at once)
 *   syncOrderRewards     after an order's status changed: its credits (issued when completed, taken back when
 *                        cancelled / refunded) and the referral it may complete. Safe to run again: it works
 *                        out what the ledger should say and writes only the difference.
 *   getOverview          what the My Account "Rewards" tab shows
 *
 * Ledger rows are never edited. Reward money-off is an ordinary coupon (coupon-store.ts counts its use and
 * gives it back when the order is cancelled, so a coupon whose order was cancelled works again).
 */
import "server-only";

import { and, desc, eq, inArray, isNotNull, ne, notInArray, or, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { affiliateReferrals, couponRedemptions, coupons, loyaltyMembers, loyaltyReferrals, loyaltyTransactions, orderItems, orders, refunds, users } from "@/db/schema";

import {
  creditsForSpend,
  eligibleSpend,
  EARNING_STATUS,
  friendCouponSpec,
  isReferralCode,
  newCouponCode,
  newReferralCode,
  redemptionCouponSpec,
  redemptionProgress,
  referrerCouponSpec,
  REDEEM_CREDITS,
  WELCOME_CREDITS,
  type RewardCouponSpec,
} from "./rules";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const normaliseEmail = (email: string) => email.trim().toLowerCase();

/** Two requests for the same thing (a double click) wait for each other, so the second one sees the first's rows. */
async function lock(db: Executor, key: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

export async function balanceOf(db: Executor, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${loyaltyTransactions.credits}), 0)` })
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.userId, userId));
  return Number(row?.total ?? 0);
}

export async function findMember(db: Executor, userId: string) {
  const [member] = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.userId, userId)).limit(1);
  return member ?? null;
}

/** The member behind a share link's code, or null (codes are case-insensitive). */
export async function findMemberByCode(code: string) {
  if (!isReferralCode(code)) return null;
  const [member] = await getDb()
    .select()
    .from(loyaltyMembers)
    .where(sql`lower(${loyaltyMembers.referralCode}) = ${code.toLowerCase()}`)
    .limit(1);
  return member ?? null;
}

async function uniqueReferralCode(db: Executor): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = newReferralCode();
    const [taken] = await db.select({ userId: loyaltyMembers.userId }).from(loyaltyMembers).where(sql`lower(${loyaltyMembers.referralCode}) = ${code}`).limit(1);
    if (!taken) return code;
  }
  throw new Error("could not make a free referral code");
}

async function createRewardCoupon(db: Executor, spec: RewardCouponSpec, email: string): Promise<string> {
  await db.insert(coupons).values({
    code: spec.code,
    type: "fixed_cart",
    amount: spec.amount,
    description: spec.description,
    usageLimit: 1,
    usageLimitPerUser: 1,
    // One coupon per order (terms §7): a coupon that is individual use never joins another.
    individualUse: true,
    minimumAmountMinor: spec.minimumAmountMinor,
    emailRestrictions: [normaliseEmail(email)],
    source: spec.source,
  });
  return spec.code;
}

export type JoinResult = { created: boolean; welcomeCredits: number };

/** Joins the programme (once): the member, their referral code and the welcome credits. */
export async function joinRewards(userId: string): Promise<JoinResult> {
  return getDb().transaction(async (tx) => {
    await lock(tx, `loyalty:${userId}`);
    if (await findMember(tx, userId)) return { created: false, welcomeCredits: 0 };
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("no such account");
    await tx.insert(loyaltyMembers).values({ userId, referralCode: await uniqueReferralCode(tx) });
    await tx.insert(loyaltyTransactions).values({ userId, type: "earn", credits: WELCOME_CREDITS, source: "welcome", reason: "Welcome reward for joining" });
    return { created: true, welcomeCredits: WELCOME_CREDITS };
  });
}

export type RedeemResult = { ok: true; code: string; balance: number } | { ok: false; reason: "not-a-member" | "not-enough-credits" };

/** 250 credits become a Rp 250,000 coupon for the member's e-mail address. */
export async function redeemCredits(userId: string): Promise<RedeemResult> {
  return getDb().transaction(async (tx) => {
    await lock(tx, `loyalty:${userId}`);
    if (!(await findMember(tx, userId))) return { ok: false, reason: "not-a-member" } as const;
    const balance = await balanceOf(tx, userId);
    if (balance < REDEEM_CREDITS) return { ok: false, reason: "not-enough-credits" } as const;
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("no such account");
    const code = await createRewardCoupon(tx, redemptionCouponSpec(newCouponCode("redeem")), user.email);
    await tx.insert(loyaltyTransactions).values({ userId, type: "redeem", credits: -REDEEM_CREDITS, source: "redemption", couponCode: code, reason: `${REDEEM_CREDITS} credits exchanged for a coupon` });
    return { ok: true, code, balance: balance - REDEEM_CREDITS } as const;
  });
}

/** Orders that don't count when asking "has this person bought before?". */
const NOT_A_PURCHASE = ["checkout-draft", "cancelled", "failed"] as const;

export type ClaimResult = { ok: true; code: string } | { ok: false; reason: "unknown-code" | "own-link" | "not-new" | "already-claimed" };

/**
 * A friend's coupon for a share link's code: for new customers only (no earlier order under their account or
 * e-mail address), never for the member's own link, once per person. Their coupon works for their address only.
 */
export async function claimFriendCoupon(userId: string, referralCode: string): Promise<ClaimResult> {
  const referrer = await findMemberByCode(referralCode);
  if (!referrer) return { ok: false, reason: "unknown-code" };
  return getDb().transaction(async (tx) => {
    await lock(tx, `loyalty-friend:${userId}`);
    const [friend] = await tx.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!friend) throw new Error("no such account");
    const email = normaliseEmail(friend.email);
    const [referrerUser] = await tx.select({ email: users.email }).from(users).where(eq(users.id, referrer.userId)).limit(1);
    if (friend.id === referrer.userId || (referrerUser && normaliseEmail(referrerUser.email) === email)) return { ok: false, reason: "own-link" } as const;
    const [claimed] = await tx.select({ id: loyaltyReferrals.id }).from(loyaltyReferrals).where(eq(loyaltyReferrals.referredUserId, userId)).limit(1);
    if (claimed) return { ok: false, reason: "already-claimed" } as const;
    const [earlier] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(or(eq(orders.userId, userId), sql`lower(${orders.billingEmail}) = ${email}`), notInArray(orders.status, [...NOT_A_PURCHASE])))
      .limit(1);
    if (earlier) return { ok: false, reason: "not-new" } as const;
    const code = await createRewardCoupon(tx, friendCouponSpec(newCouponCode("friend")), email);
    await tx.insert(loyaltyReferrals).values({ referrerUserId: referrer.userId, referredUserId: userId, referredEmail: email, friendCouponCode: code });
    return { ok: true, code } as const;
  });
}

/** What the ledger should say for an order, and the difference to write (exported for the tests). */
export async function syncOrderCredits(db: Executor, orderId: string): Promise<number> {
  await lock(db, `loyalty-order:${orderId}`);
  const [order] = await db.select({ userId: orders.userId, status: orders.status, createdAt: orders.createdAt }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.userId) return 0;
  const member = await findMember(db, order.userId);
  if (!member) return 0;
  const lines = await db.select({ total: orderItems.lineTotalMinor }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const [refunded] = await db.select({ total: sql<string>`coalesce(sum(${refunds.amountMinor}), 0)` }).from(refunds).where(eq(refunds.orderId, orderId));
  const [given] = await db
    .select({ total: sql<string>`coalesce(sum(${loyaltyTransactions.credits}), 0)` })
    .from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.orderId, orderId), eq(loyaltyTransactions.userId, order.userId)));
  const current = Number(given?.total ?? 0);
  // Credits are for orders placed after joining (or that already have credits, e.g. imported ones), and only a completed order keeps them.
  const placedAfterJoining = order.createdAt.getTime() >= member.joinedAt.getTime();
  const counts = order.status === EARNING_STATUS && (placedAfterJoining || current !== 0);
  const desired = counts ? creditsForSpend(eligibleSpend(lines.map((line) => line.total), BigInt(refunded?.total ?? 0))) : 0;
  const delta = desired - current;
  if (delta === 0) return 0;
  await db.insert(loyaltyTransactions).values({
    userId: order.userId,
    type: delta > 0 ? "earn" : "reverse",
    credits: delta,
    source: "order",
    orderId,
    reason: delta > 0 ? "Credits for a completed order" : order.status === EARNING_STATUS ? "Credits recalculated after a refund" : `Credits taken back: the order is ${order.status}`,
  });
  return delta;
}

/** A coupon of this order that an affiliate owns: the order is the affiliate's, so no friend reward (terms §6). */
async function creditedToAffiliate(db: Executor, orderId: string, codes: string[]): Promise<boolean> {
  const [referral] = await db.select({ id: affiliateReferrals.id }).from(affiliateReferrals).where(eq(affiliateReferrals.orderId, orderId)).limit(1);
  if (referral) return true;
  if (!codes.length) return false;
  const [coupon] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(and(inArray(sql`lower(${coupons.code})`, codes), or(eq(coupons.source, "affiliate"), isNotNull(coupons.affiliateId))))
    .limit(1);
  return Boolean(coupon);
}

/** The referral an order completes (it was paid with the friend's coupon), and the referrer's reward. */
export async function syncReferralForOrder(db: Executor, orderId: string): Promise<void> {
  const [order] = await db.select({ id: orders.id, status: orders.status, userId: orders.userId, email: orders.billingEmail }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const used = (await db.select({ code: couponRedemptions.code }).from(couponRedemptions).where(eq(couponRedemptions.orderId, orderId))).map((row) => row.code.toLowerCase());
  const [referral] = used.length ? await db.select().from(loyaltyReferrals).where(inArray(sql`lower(${loyaltyReferrals.friendCouponCode})`, used)).limit(1) : [];
  if (!referral) return;
  await lock(db, `loyalty-referral:${referral.id}`);
  const [fresh] = await db.select().from(loyaltyReferrals).where(eq(loyaltyReferrals.id, referral.id)).limit(1);
  if (!fresh) return;
  const now = new Date();

  if (order.status === EARNING_STATUS && fresh.status === "pending") {
    const [referrer] = await db.select({ email: users.email }).from(users).where(eq(users.id, fresh.referrerUserId)).limit(1);
    const selfReferral = order.userId === fresh.referrerUserId || (referrer && normaliseEmail(referrer.email) === normaliseEmail(order.email));
    if (selfReferral || (await creditedToAffiliate(db, orderId, used))) {
      await db
        .update(loyaltyReferrals)
        .set({ status: "rejected", referredOrderId: order.id, note: selfReferral ? "The order belongs to the member who referred." : "The order is credited to an affiliate: an order can't earn both.", updatedAt: now })
        .where(eq(loyaltyReferrals.id, fresh.id));
      return;
    }
    if (!referrer) return;
    const code = await createRewardCoupon(db, referrerCouponSpec(newCouponCode("reward")), referrer.email);
    await db.update(loyaltyReferrals).set({ status: "rewarded", rewardCouponCode: code, referredOrderId: order.id, convertedAt: now, updatedAt: now }).where(eq(loyaltyReferrals.id, fresh.id));
    return;
  }

  const undone = order.status === "cancelled" || order.status === "refunded" || order.status === "failed";
  if (undone && fresh.status === "rewarded" && fresh.referredOrderId === order.id) {
    // The reward can be taken back only while it is unused (terms §8).
    let note = "The qualifying order is no longer valid.";
    if (fresh.rewardCouponCode) {
      const [reward] = await db.select({ id: coupons.id, usageCount: coupons.usageCount }).from(coupons).where(sql`lower(${coupons.code}) = ${fresh.rewardCouponCode.toLowerCase()}`).limit(1);
      if (reward && reward.usageCount === 0) await db.update(coupons).set({ enabled: false, updatedAt: now }).where(eq(coupons.id, reward.id));
      else note += " The reward coupon was already used.";
    }
    await db.update(loyaltyReferrals).set({ status: "reversed", note, updatedAt: now }).where(eq(loyaltyReferrals.id, fresh.id));
  }
}

/**
 * After an order's status changed (called by setOrderStatus once its own change is saved): its credits and the
 * referral it may complete. A failure here is logged and never stops the order's change.
 */
export async function syncOrderRewards(orderId: string): Promise<void> {
  try {
    await getDb().transaction(async (tx) => {
      await syncOrderCredits(tx, orderId);
      await syncReferralForOrder(tx, orderId);
    });
  } catch (error) {
    console.error("[rewards] could not update the rewards of an order", error instanceof Error ? error.message : "error");
  }
}

export type RewardCoupon = { code: string; amountRupiah: number; minimumMinor: bigint; kind: "redemption" | "referral"; description: string; used: boolean };
export type ReferralRow = { status: "pending" | "rewarded" | "reversed" | "rejected"; friend: string; createdAt: Date };
export type LedgerRow = { id: string; type: string; credits: number; source: string; reason: string | null; orderNumber: bigint | null; createdAt: Date };

/** A friend's address shown to the member without giving it away ("j***@example.com"). */
export function maskEmail(email: string | null): string {
  if (!email || !email.includes("@")) return "A friend";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

export type Overview = {
  member: { referralCode: string; joinedAt: Date };
  balance: number;
  progress: { redeemable: number; toNext: number };
  coupons: RewardCoupon[];
  referrals: ReferralRow[];
  ledger: LedgerRow[];
} | null;

/** Everything the Rewards tab shows; null when the customer hasn't joined. */
export async function getOverview(userId: string, email: string): Promise<Overview> {
  const db = getDb();
  const member = await findMember(db, userId);
  if (!member) return null;
  const address = normaliseEmail(email);
  const [balance, couponRows, referralRows, ledgerRows] = await Promise.all([
    balanceOf(db, userId),
    db
      .select()
      .from(coupons)
      .where(and(inArray(coupons.source, ["rewards_redemption", "rewards_referral", "rewards_welcome"]), sql`${coupons.emailRestrictions} @> ARRAY[${address}]::text[]`))
      .orderBy(desc(coupons.createdAt)),
    db.select().from(loyaltyReferrals).where(eq(loyaltyReferrals.referrerUserId, userId)).orderBy(desc(loyaltyReferrals.createdAt)),
    db
      .select({ id: loyaltyTransactions.id, type: loyaltyTransactions.type, credits: loyaltyTransactions.credits, source: loyaltyTransactions.source, reason: loyaltyTransactions.reason, orderNumber: orders.orderNumber, createdAt: loyaltyTransactions.createdAt })
      .from(loyaltyTransactions)
      .leftJoin(orders, eq(orders.id, loyaltyTransactions.orderId))
      // A 0-credit row is only a marker (an imported pending purchase): nothing to show.
      .where(and(eq(loyaltyTransactions.userId, userId), ne(loyaltyTransactions.credits, 0)))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(25),
  ]);
  return {
    member: { referralCode: member.referralCode, joinedAt: member.joinedAt },
    balance,
    progress: redemptionProgress(balance),
    coupons: couponRows
      .filter((row) => row.enabled)
      .map((row) => ({
        code: row.code,
        amountRupiah: Number(row.amount.split(".")[0]),
        minimumMinor: row.minimumAmountMinor ?? 0n,
        kind: row.source === "rewards_redemption" ? ("redemption" as const) : ("referral" as const),
        description: row.description ?? "",
        used: row.usageLimit !== null && row.usageCount >= row.usageLimit,
      })),
    referrals: referralRows.map((row) => ({ status: row.status, friend: maskEmail(row.referredEmail), createdAt: row.createdAt })),
    ledger: ledgerRows,
  };
}

/** A friend's coupon waiting for the logged-in customer: their referral row and whether the coupon is still unused. */
export async function friendCouponFor(userId: string): Promise<{ code: string; used: boolean } | null> {
  const db = getDb();
  const [row] = await db.select({ code: loyaltyReferrals.friendCouponCode }).from(loyaltyReferrals).where(and(eq(loyaltyReferrals.referredUserId, userId), ne(loyaltyReferrals.status, "rejected"))).limit(1);
  if (!row?.code) return null;
  const [coupon] = await db.select({ usageCount: coupons.usageCount, usageLimit: coupons.usageLimit }).from(coupons).where(sql`lower(${coupons.code}) = ${row.code.toLowerCase()}`).limit(1);
  return { code: row.code, used: Boolean(coupon && coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) };
}
