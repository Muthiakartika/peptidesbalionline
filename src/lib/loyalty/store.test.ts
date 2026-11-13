/**
 * The rewards programme on a real (in-memory) Postgres with every migration: joining, credits for orders
 * (earned when completed, taken back when cancelled or refunded), redeeming, and "refer a friend". Made-up
 * accounts, e-mails and codes only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown, mail: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
// The order e-mails a status change sends are collected here, never sent or saved.
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: async (email: { to: string; subject: string; text: string }) => {
    state.mail.push(email);
    return "sent";
  },
}));

const store = await import("./store");
const couponStore = await import("@/lib/commerce/coupon-store");
const coupons = await import("@/lib/commerce/coupons");
type Db = Parameters<typeof store.syncOrderCredits>[0];

const rp = (rupiah: number) => BigInt(rupiah) * 100n;

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let counter = 0;

const newUser = async (email: string) => {
  const id = `u-${++counter}`;
  await db.insert(schema.users).values({ id, name: email.split("@")[0], email });
  return id;
};

/** An order with one product line of `lineRupiah` after discounts (shipping and fees are not lines). */
const newOrder = async (userId: string | null, email: string, status: (typeof schema.orders.$inferInsert)["status"], lineRupiah: number, createdAt = new Date()) => {
  const [order] = await db
    .insert(schema.orders)
    .values({
      orderKey: `wc_order_${Math.random().toString(36).slice(2, 15)}`,
      userId,
      status,
      subtotalMinor: rp(lineRupiah),
      shippingMinor: rp(50_000),
      totalMinor: rp(lineRupiah + 50_000),
      billingEmail: email,
      billing: {},
      paymentMethod: "sleeks_wise",
      paymentMethodTitle: "Wise",
      createdAt,
    })
    .returning({ id: schema.orders.id });
  await db.insert(schema.orderItems).values({ orderId: order.id, productName: "Test product", quantity: 1, unitPriceMinor: rp(lineRupiah), lineSubtotalMinor: rp(lineRupiah), lineTotalMinor: rp(lineRupiah) });
  return order.id;
};

const setStatus = async (orderId: string, status: (typeof schema.orders.$inferInsert)["status"]) => {
  await db.update(schema.orders).set({ status }).where(eq(schema.orders.id, orderId));
  await store.syncOrderRewards(orderId);
};

const balance = (userId: string) => store.balanceOf(db as unknown as Db, userId);
const coupon = async (code: string) => (await db.select().from(schema.coupons).where(eq(schema.coupons.code, code)))[0];
const referrals = (referrerId: string) => db.select().from(schema.loyaltyReferrals).where(eq(schema.loyaltyReferrals.referrerUserId, referrerId));

beforeAll(async () => {
  pg = new PGlite();
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  db = drizzle(pg, { schema });
  state.db = db;
}, 60_000);

describe("joining", () => {
  it("gives the welcome credits once and a referral code", async () => {
    const id = await newUser("join@example.com");
    expect(await store.joinRewards(id)).toEqual({ created: true, welcomeCredits: 50 });
    expect(await store.joinRewards(id)).toEqual({ created: false, welcomeCredits: 0 });
    expect(await balance(id)).toBe(50);
    const member = await store.findMember(db as unknown as Db, id);
    expect(member?.referralCode).toMatch(/^[0-9a-f]{7}$/);
    expect(await store.findMemberByCode(member!.referralCode.toUpperCase())).toMatchObject({ userId: id });
  });

  it("is safe when two requests join at the same moment", async () => {
    const id = await newUser("double@example.com");
    const results = await Promise.all([store.joinRewards(id), store.joinRewards(id)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await balance(id)).toBe(50);
  });

  it("refuses an account that doesn't exist and an unknown code", async () => {
    await expect(store.joinRewards("nobody")).rejects.toThrow();
    expect(await store.findMemberByCode("ffffff0")).toBeNull();
    expect(await store.findMemberByCode("../../x")).toBeNull();
  });
});

describe("credits for orders", () => {
  it("issues credits when an order is completed, rounded down, without shipping", async () => {
    const id = await newUser("earn@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "earn@example.com", "processing", 2_549_999);
    await store.syncOrderRewards(orderId);
    expect(await balance(id)).toBe(50);
    await setStatus(orderId, "completed");
    // Rp 2,549,999 → 254 credits (the Rp 50,000 shipping doesn't count).
    expect(await balance(id)).toBe(50 + 254);
  });

  it("writes only the difference when it runs again", async () => {
    const id = await newUser("again@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "again@example.com", "completed", 1_000_000);
    await store.syncOrderRewards(orderId);
    await store.syncOrderRewards(orderId);
    await store.syncOrderRewards(orderId);
    expect(await balance(id)).toBe(150);
    const rows = await db.select().from(schema.loyaltyTransactions).where(eq(schema.loyaltyTransactions.orderId, orderId));
    expect(rows).toHaveLength(1);
  });

  it("takes the credits back when the order is cancelled or refunded, and gives them again if it comes back", async () => {
    const id = await newUser("undo@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "undo@example.com", "processing", 2_000_000);
    await setStatus(orderId, "completed");
    expect(await balance(id)).toBe(250);
    await setStatus(orderId, "refunded");
    expect(await balance(id)).toBe(50);
    await setStatus(orderId, "completed");
    expect(await balance(id)).toBe(250);
    await setStatus(orderId, "cancelled");
    expect(await balance(id)).toBe(50);
  });

  it("recalculates after a partial refund", async () => {
    const id = await newUser("partial@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "partial@example.com", "completed", 1_000_000);
    await store.syncOrderRewards(orderId);
    expect(await balance(id)).toBe(150);
    await db.insert(schema.refunds).values({ orderId, amountMinor: rp(400_000) });
    await store.syncOrderRewards(orderId);
    expect(await balance(id)).toBe(110);
  });

  it("gives nothing to a guest, to a customer who didn't join, or for an order placed before joining", async () => {
    const guestOrder = await newOrder(null, "guest@example.com", "completed", 1_000_000);
    await store.syncOrderRewards(guestOrder);
    const plain = await newUser("plain@example.com");
    const plainOrder = await newOrder(plain, "plain@example.com", "completed", 1_000_000);
    await store.syncOrderRewards(plainOrder);
    expect(await balance(plain)).toBe(0);

    const late = await newUser("late@example.com");
    const oldOrder = await newOrder(late, "late@example.com", "processing", 1_000_000, new Date(Date.now() - 86_400_000));
    await store.joinRewards(late);
    await setStatus(oldOrder, "completed");
    expect(await balance(late)).toBe(50);
  });

  it("keeps imported credits that belong to an order", async () => {
    const id = await newUser("imported@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "imported@example.com", "completed", 2_880_000, new Date(Date.now() - 86_400_000));
    await db.insert(schema.loyaltyTransactions).values({ userId: id, type: "migration", credits: 288, source: "import", orderId });
    await store.syncOrderRewards(orderId);
    // The 288 imported credits are the credits of this order: nothing is added twice.
    expect(await balance(id)).toBe(50 + 288);
  });
});

describe("redeeming", () => {
  it("needs 250 credits and makes a single-use Rp 250,000 coupon for the member's address", async () => {
    const id = await newUser("redeem@example.com");
    expect(await store.redeemCredits(id)).toEqual({ ok: false, reason: "not-a-member" });
    await store.joinRewards(id);
    expect(await store.redeemCredits(id)).toEqual({ ok: false, reason: "not-enough-credits" });
    await db.insert(schema.loyaltyTransactions).values({ userId: id, type: "adjust", credits: 450, source: "admin" });
    const result = await store.redeemCredits(id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.balance).toBe(250);
    expect(await balance(id)).toBe(250);
    expect(await coupon(result.code)).toMatchObject({
      type: "fixed_cart",
      amount: "250000.00",
      usageLimit: 1,
      individualUse: true,
      minimumAmountMinor: rp(2_500_000),
      emailRestrictions: ["redeem@example.com"],
      source: "rewards_redemption",
      enabled: true,
    });
    // 250 left: a second redemption works, a third doesn't.
    expect((await store.redeemCredits(id)).ok).toBe(true);
    expect(await store.redeemCredits(id)).toEqual({ ok: false, reason: "not-enough-credits" });
  });

  it("can't spend the same credits twice when two requests arrive together", async () => {
    const id = await newUser("race@example.com");
    await store.joinRewards(id);
    await db.insert(schema.loyaltyTransactions).values({ userId: id, type: "adjust", credits: 200, source: "admin" });
    const results = await Promise.all([store.redeemCredits(id), store.redeemCredits(id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await balance(id)).toBe(0);
  });
});

describe("refer a friend", () => {
  const member = async (email: string) => {
    const id = await newUser(email);
    await store.joinRewards(id);
    return { id, code: (await store.findMember(db as unknown as Db, id))!.referralCode };
  };

  it("gives a new customer a Rp 250,000 coupon for a first order of Rp 3,000,000 or more", async () => {
    const referrer = await member("referrer1@example.com");
    const friend = await newUser("friend1@example.com");
    const claim = await store.claimFriendCoupon(friend, referrer.code);
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(await coupon(claim.code)).toMatchObject({ amount: "250000.00", minimumAmountMinor: rp(3_000_000), individualUse: true, usageLimit: 1, emailRestrictions: ["friend1@example.com"] });
    expect(await referrals(referrer.id)).toMatchObject([{ status: "pending", referredUserId: friend, friendCouponCode: claim.code }]);
    expect(await store.friendCouponFor(friend)).toEqual({ code: claim.code, used: false });
  });

  it("refuses an unknown code, the member's own link, a second claim, and a customer who bought before", async () => {
    const referrer = await member("referrer2@example.com");
    expect(await store.claimFriendCoupon(referrer.id, referrer.code)).toEqual({ ok: false, reason: "own-link" });
    const friend = await newUser("friend2@example.com");
    expect(await store.claimFriendCoupon(friend, "ffffff1")).toEqual({ ok: false, reason: "unknown-code" });
    expect((await store.claimFriendCoupon(friend, referrer.code)).ok).toBe(true);
    expect(await store.claimFriendCoupon(friend, referrer.code)).toEqual({ ok: false, reason: "already-claimed" });

    const buyer = await newUser("buyer2@example.com");
    await newOrder(buyer, "buyer2@example.com", "processing", 500_000);
    expect(await store.claimFriendCoupon(buyer, referrer.code)).toEqual({ ok: false, reason: "not-new" });
    // An order under the same e-mail address counts too, even as a guest; a cancelled one doesn't.
    const sameEmail = await newUser("guestbuyer@example.com");
    await newOrder(null, "GuestBuyer@Example.com", "completed", 500_000);
    expect(await store.claimFriendCoupon(sameEmail, referrer.code)).toEqual({ ok: false, reason: "not-new" });
    const cancelled = await newUser("cancelled@example.com");
    await newOrder(cancelled, "cancelled@example.com", "cancelled", 500_000);
    expect((await store.claimFriendCoupon(cancelled, referrer.code)).ok).toBe(true);
  });

  /** The friend's order paid with the friend's coupon, as the checkout records it. */
  const friendOrder = async (friendId: string, email: string, couponCode: string, status: (typeof schema.orders.$inferInsert)["status"] = "processing") => {
    const orderId = await newOrder(friendId, email, status, 3_200_000);
    await db.insert(schema.couponRedemptions).values({ code: couponCode, orderId, userId: friendId, email, amountMinor: rp(250_000) });
    return orderId;
  };

  it("rewards the member when the friend's order is completed, once", async () => {
    const referrer = await member("referrer3@example.com");
    const friend = await newUser("friend3@example.com");
    const claim = await store.claimFriendCoupon(friend, referrer.code);
    if (!claim.ok) throw new Error("claim failed");
    const orderId = await friendOrder(friend, "friend3@example.com", claim.code);
    await store.syncOrderRewards(orderId);
    expect((await referrals(referrer.id))[0].status).toBe("pending");
    await setStatus(orderId, "completed");
    const [row] = await referrals(referrer.id);
    expect(row).toMatchObject({ status: "rewarded", referredOrderId: orderId });
    expect(await coupon(row.rewardCouponCode!)).toMatchObject({ amount: "250000.00", minimumAmountMinor: rp(2_500_000), individualUse: true, usageLimit: 1, emailRestrictions: ["referrer3@example.com"], enabled: true });
    // Completing again (or running the sync again) doesn't make a second reward.
    await store.syncOrderRewards(orderId);
    const coupons = await db.select().from(schema.coupons).where(sql`${schema.coupons.source} = 'rewards_referral' and ${schema.coupons.emailRestrictions} @> ARRAY['referrer3@example.com']::text[]`);
    expect(coupons).toHaveLength(1);
  });

  it("takes an unused reward back when the qualifying order is refunded, and keeps a used one", async () => {
    const referrer = await member("referrer4@example.com");
    const friend = await newUser("friend4@example.com");
    const claim = await store.claimFriendCoupon(friend, referrer.code);
    if (!claim.ok) throw new Error("claim failed");
    const orderId = await friendOrder(friend, "friend4@example.com", claim.code, "completed");
    await store.syncOrderRewards(orderId);
    const [rewarded] = await referrals(referrer.id);
    await setStatus(orderId, "refunded");
    expect((await referrals(referrer.id))[0].status).toBe("reversed");
    expect(await coupon(rewarded.rewardCouponCode!)).toMatchObject({ enabled: false });

    const referrer2 = await member("referrer5@example.com");
    const friend2 = await newUser("friend5@example.com");
    const claim2 = await store.claimFriendCoupon(friend2, referrer2.code);
    if (!claim2.ok) throw new Error("claim failed");
    const order2 = await friendOrder(friend2, "friend5@example.com", claim2.code, "completed");
    await store.syncOrderRewards(order2);
    const [rewarded2] = await referrals(referrer2.id);
    await db.update(schema.coupons).set({ usageCount: 1 }).where(eq(schema.coupons.code, rewarded2.rewardCouponCode!));
    await setStatus(order2, "cancelled");
    const [after] = await referrals(referrer2.id);
    expect(after.status).toBe("reversed");
    expect(after.note).toContain("already used");
    expect(await coupon(rewarded2.rewardCouponCode!)).toMatchObject({ enabled: true });
  });

  it("gives no reward when the order is an affiliate's (an order can't earn both)", async () => {
    const referrer = await member("referrer6@example.com");
    const friend = await newUser("friend6@example.com");
    const claim = await store.claimFriendCoupon(friend, referrer.code);
    if (!claim.ok) throw new Error("claim failed");
    const orderId = await friendOrder(friend, "friend6@example.com", claim.code);
    const [affiliate] = await db.insert(schema.affiliates).values({ status: "active", usernameSlug: "aff-test" }).returning({ id: schema.affiliates.id });
    await db.insert(schema.affiliateReferrals).values({ affiliateId: affiliate.id, orderId, amountMinor: rp(300_000), status: "pending" });
    await setStatus(orderId, "completed");
    const [row] = await referrals(referrer.id);
    expect(row.status).toBe("rejected");
    expect(row.rewardCouponCode).toBeNull();
    expect(row.note).toContain("affiliate");
  });

  it("gives no reward for the member's own order", async () => {
    const referrer = await member("referrer7@example.com");
    const friend = await newUser("friend7@example.com");
    const claim = await store.claimFriendCoupon(friend, referrer.code);
    if (!claim.ok) throw new Error("claim failed");
    // The friend's coupon used on an order placed with the referrer's own e-mail address.
    const orderId = await newOrder(null, "Referrer7@example.com", "processing", 3_200_000);
    await db.insert(schema.couponRedemptions).values({ code: claim.code, orderId, email: "referrer7@example.com", amountMinor: rp(250_000) });
    await setStatus(orderId, "completed");
    expect((await referrals(referrer.id))[0].status).toBe("rejected");
  });
});

describe("an order's status change (the shop's own function)", () => {
  it("issues credits when the order is completed and takes them back when it is cancelled", async () => {
    const { setOrderStatus } = await import("@/lib/commerce/orders");
    const id = await newUser("status@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "status@example.com", "processing", 1_200_000);
    expect(await balance(id)).toBe(50);
    expect(await setOrderStatus(orderId, "completed", "", id)).toBe(true);
    expect(await balance(id)).toBe(50 + 120);
    // The same status again changes nothing and doesn't pay twice.
    expect(await setOrderStatus(orderId, "completed", "", id)).toBe(false);
    expect(await balance(id)).toBe(50 + 120);
    expect(await setOrderStatus(orderId, "cancelled", "", id)).toBe(true);
    expect(await balance(id)).toBe(50);
  });

  it("sends WooCommerce's e-mails for each change, to the shop and to the customer", async () => {
    const { setOrderStatus } = await import("@/lib/commerce/orders");
    const orderId = await newOrder(null, "mail@example.com", "pending", 900_000);
    state.mail.length = 0;
    const sent = () => state.mail.splice(0).map((m) => `${m.to} | ${m.subject}`);
    const [{ number }] = await db.select({ number: schema.orders.orderNumber }).from(schema.orders).where(eq(schema.orders.id, orderId));

    await setOrderStatus(orderId, "on-hold");
    expect(sent()).toEqual([`hello@peptidesbali.online | [Atlas Longevity]: You've got a new order: #${number}`, "mail@example.com | Your Atlas Longevity order has been received!"]);
    await setOrderStatus(orderId, "processing");
    expect(sent()).toEqual(["mail@example.com | Your Atlas Longevity order has been received!"]);
    await setOrderStatus(orderId, "processing");
    expect(sent()).toEqual([]);
    await setOrderStatus(orderId, "completed");
    expect(sent()).toEqual(["mail@example.com | Your order from Atlas Longevity is on its way!"]);
    // WooCommerce sends nothing when a completed order is cancelled.
    await setOrderStatus(orderId, "cancelled");
    expect(sent()).toEqual([]);
  });

  it("never stops the status change if the e-mails can't be sent", async () => {
    const { setOrderStatus } = await import("@/lib/commerce/orders");
    const orderId = await newOrder(null, "nomail@example.com", "pending", 900_000);
    await pg.exec("ALTER TABLE order_items RENAME TO order_items_off");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await setOrderStatus(orderId, "processing")).toBe(true);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      await pg.exec("ALTER TABLE order_items_off RENAME TO order_items");
    }
    const [row] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(row.status).toBe("processing");
  });

  it("never stops the status change if the rewards can't be updated", async () => {
    const { setOrderStatus } = await import("@/lib/commerce/orders");
    const id = await newUser("broken@example.com");
    await store.joinRewards(id);
    const orderId = await newOrder(id, "broken@example.com", "processing", 1_000_000);
    await pg.exec("ALTER TABLE loyalty_transactions RENAME TO loyalty_transactions_off");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await setOrderStatus(orderId, "completed", "", id)).toBe(true);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      await pg.exec("ALTER TABLE loyalty_transactions_off RENAME TO loyalty_transactions");
    }
    const [row] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(row.status).toBe("completed");
  });
});

describe("reward coupons in the shop's coupon engine", () => {
  const { applyCoupon, couponDiscounts, validateCoupon } = coupons;
  const lines = (rupiah: number) => [{ key: "p1", productId: 1, variationId: null, name: "Test product", categories: [], onSale: false, unitPrice: rp(rupiah), quantity: 1 }];

  it("takes Rp 250,000 off an order of Rp 2,500,000 or more, for the owner's e-mail address only", async () => {
    const id = await newUser("engine@example.com");
    await store.joinRewards(id);
    await db.insert(schema.loyaltyTransactions).values({ userId: id, type: "adjust", credits: 250, source: "admin" });
    const redeemed = await store.redeemCredits(id);
    if (!redeemed.ok) throw new Error("redeem failed");
    const [stored] = [...(await couponStore.findCoupons([redeemed.code.toUpperCase()])).values()];

    expect(validateCoupon(stored, lines(2_500_000), { emails: ["engine@example.com"] })).toBeNull();
    expect(validateCoupon(stored, lines(2_499_999), { emails: ["engine@example.com"] })).toContain("minimum spend");
    expect(validateCoupon(stored, lines(3_000_000), { emails: ["someone-else@example.com"] })).toContain("valid email");
    // An address written differently is still the owner's.
    expect(validateCoupon(stored, lines(3_000_000), { emails: ["Engine@Example.com "] })).toBeNull();
    const discounts = couponDiscounts([stored], lines(3_000_000));
    expect(discounts.get(stored.code)?.get("p1")).toBe(rp(250_000));
  });

  it("can't be combined with another coupon, and works once", async () => {
    const id = await newUser("single@example.com");
    await store.joinRewards(id);
    await db.insert(schema.loyaltyTransactions).values({ userId: id, type: "adjust", credits: 250, source: "admin" });
    const redeemed = await store.redeemCredits(id);
    if (!redeemed.ok) throw new Error("redeem failed");
    const [reward] = [...(await couponStore.findCoupons([redeemed.code])).values()];
    const [other] = await db.insert(schema.coupons).values({ code: "ten-engine", type: "percent", amount: "10.00" }).returning();
    const otherCoupon = { ...reward, code: other.code, individualUse: false, type: "percent" as const, amount: "10.00", usageLimit: null, minimumAmount: null, emailRestrictions: [] };
    // Another coupon is in the cart first. The reward is individual use, so it replaces it (as WooCommerce does):
    // the cart ends with the reward alone, and a coupon can't be added next to it.
    const first = applyCoupon(otherCoupon, otherCoupon.code, lines(3_000_000), []);
    expect(first.ok).toBe(true);
    const second = applyCoupon(reward, reward.code, lines(3_000_000), first.ok ? first.applied : [], { emails: ["single@example.com"] });
    expect(second.ok && second.applied.map((c) => c.code)).toEqual([reward.code]);
    const third = applyCoupon(otherCoupon, otherCoupon.code, lines(3_000_000), second.ok ? second.applied : []);
    expect(third.ok).toBe(false);
    // Used once: after its order is counted the coupon is spent.
    const orderId = await newOrder(id, "single@example.com", "pending", 3_000_000);
    await couponStore.recordOrderCoupons(db as unknown as Parameters<typeof couponStore.recordOrderCoupons>[0], { orderId, userId: id, email: "single@example.com", status: "pending", coupons: [{ coupon: reward, amount: rp(250_000) }] });
    const [spent] = [...(await couponStore.findCoupons([reward.code])).values()];
    expect(validateCoupon(spent, lines(3_000_000), { emails: ["single@example.com"] })).toContain("Usage limit");
    // Cancelling that order gives the coupon back.
    await couponStore.updateCouponUsageForStatus(db as unknown as Parameters<typeof couponStore.recordOrderCoupons>[0], orderId, "cancelled");
    const [back] = [...(await couponStore.findCoupons([reward.code])).values()];
    expect(validateCoupon(back, lines(3_000_000), { emails: ["single@example.com"] })).toBeNull();
  });
});

describe("what the Rewards tab shows", () => {
  it("is nothing for a customer who hasn't joined, and balance, progress, coupons and history for a member", async () => {
    const id = await newUser("tab@example.com");
    expect(await store.getOverview(id, "tab@example.com")).toBeNull();
    await store.joinRewards(id);
    await db.insert(schema.loyaltyTransactions).values({ userId: id, type: "adjust", credits: 220, source: "admin", reason: "test" });
    const redeemed = await store.redeemCredits(id);
    if (!redeemed.ok) throw new Error("redeem failed");
    const overview = await store.getOverview(id, "Tab@Example.com");
    expect(overview).toMatchObject({ balance: 20, progress: { redeemable: 0, toNext: 230 } });
    expect(overview?.coupons).toEqual([expect.objectContaining({ code: redeemed.code, amountRupiah: 250_000, kind: "redemption", used: false })]);
    expect(overview?.ledger.map((row) => row.credits).sort((a, b) => a - b)).toEqual([-250, 50, 220]);
  });

  it("shows a friend's address without giving it away", () => {
    expect(store.maskEmail("jane@example.com")).toBe("j***@example.com");
    expect(store.maskEmail(null)).toBe("A friend");
  });
});
