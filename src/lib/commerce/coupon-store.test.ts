/**
 * Coupons in the database, on a real (in-memory) Postgres with every migration: the cart check
 * (WC_Cart::check_cart_coupons) and the usage bookkeeping (wc_update_coupon_usage_counts). Made-up codes
 * and e-mails only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const { checkCartCoupons, couponCustomer, recordOrderCoupons, updateCouponUsageForStatus, findCoupons } = await import("./coupon-store");
type Db = Parameters<typeof updateCouponUsageForStatus>[0];

const rp = (rupiah: number) => BigInt(rupiah) * 100n;
const line = (key: string, rupiah: number) => ({ key, productId: Number(key.replace(/\D/g, "")) || 1, variationId: null, name: key, categories: [], onSale: false, unitPrice: rp(rupiah), quantity: 1 });

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
const userId = "u-imported";

beforeAll(async () => {
  pg = new PGlite();
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  db = drizzle(pg, { schema });
  state.db = db;
  await db.insert(schema.users).values({ id: userId, name: "Test Buyer", email: "buyer@example.com", legacyWpUserId: 20 });
  await db.insert(schema.coupons).values([
    { code: "welcome-test", type: "percent", amount: "5.00", minimumAmountMinor: rp(800_000), usageLimitPerUser: 1, individualUse: true, usageCount: 1, usedBy: ["20"] },
    { code: "ten-test", type: "percent", amount: "10.00" },
    { code: "draft-test", type: "percent", amount: "50.00", enabled: false },
  ]);
}, 60_000);

const newOrder = async (status: "pending" | "on-hold", user: string | null, email: string) => {
  const [order] = await db
    .insert(schema.orders)
    .values({ orderKey: `wc_order_${Math.random().toString(36).slice(2, 15)}`, userId: user, status, subtotalMinor: rp(900_000), totalMinor: rp(855_000), billingEmail: email, billing: {}, paymentMethod: "sleeks_wise", paymentMethodTitle: "Wise" })
    .returning({ id: schema.orders.id });
  return order.id;
};
const usage = async (code: string) => (await db.select({ n: schema.coupons.usageCount, by: schema.coupons.usedBy }).from(schema.coupons).where(eq(schema.coupons.code, code)))[0];

describe("coupons in the database", () => {
  it("finds published coupons only, case-insensitively (a draft does not exist)", async () => {
    const found = await findCoupons(["WELCOME-TEST", "draft-test", "nope"]);
    expect([...found.keys()]).toEqual(["welcome-test"]);
    expect(found.get("welcome-test")).toMatchObject({ minimumAmount: rp(800_000), usageLimitPerUser: 1, usedBy: ["20"] });
  });

  it("drops the coupons a cart no longer qualifies for, with WooCommerce's notice", async () => {
    const guest = await couponCustomer(null);
    const ok = await checkCartCoupons(["welcome-test", "ten-test", "gone-test"], [line("p1", 900_000)], guest);
    expect(ok.coupons.map((c) => c.code)).toEqual(["welcome-test", "ten-test"]);
    expect(ok.notices).toEqual(['Sorry, it seems the coupon "gone-test" is invalid - it has now been removed from your order.']);
    // Under the minimum spend.
    const small = await checkCartCoupons(["welcome-test"], [line("p1", 500_000)], guest);
    expect(small.removedCodes).toEqual(["welcome-test"]);
  });

  it("counts a logged-in customer's earlier use by their WordPress user ID", async () => {
    const customer = await couponCustomer({ id: userId, email: "buyer@example.com" });
    expect(customer.keys).toEqual([userId, "20"]);
    const check = await checkCartCoupons(["welcome-test"], [line("p1", 900_000)], customer);
    expect(check.removedCodes).toEqual(["welcome-test"]);
  });

  it("counts an order's coupons once, gives them back when cancelled, and counts them again if it comes back", async () => {
    const [welcome] = [...(await findCoupons(["welcome-test"])).values()];
    const orderId = await newOrder("on-hold", userId, "buyer@example.com");
    await recordOrderCoupons(db as unknown as Db, { orderId, userId, email: "Buyer@Example.com", status: "on-hold", coupons: [{ coupon: welcome, amount: rp(45_000) }] });
    expect(await usage("welcome-test")).toEqual({ n: 2, by: ["20", "20"] });
    // The same status again changes nothing (orders.coupon_usage_recorded).
    await updateCouponUsageForStatus(db as unknown as Db, orderId, "processing");
    expect((await usage("welcome-test")).n).toBe(2);
    await updateCouponUsageForStatus(db as unknown as Db, orderId, "cancelled");
    expect(await usage("welcome-test")).toEqual({ n: 1, by: ["20"] });
    await updateCouponUsageForStatus(db as unknown as Db, orderId, "pending");
    expect((await usage("welcome-test")).n).toBe(2);
    const [redemption] = await db.select().from(schema.couponRedemptions).where(eq(schema.couponRedemptions.orderId, orderId));
    expect(redemption).toMatchObject({ code: "welcome-test", amountMinor: rp(45_000), email: "buyer@example.com" });
  });

  it("records a guest by billing e-mail", async () => {
    const [ten] = [...(await findCoupons(["ten-test"])).values()];
    const orderId = await newOrder("pending", null, "guest@example.com");
    await recordOrderCoupons(db as unknown as Db, { orderId, userId: null, email: "Guest@Example.com", status: "pending", coupons: [{ coupon: ten, amount: rp(90_000) }] });
    expect(await usage("ten-test")).toEqual({ n: 1, by: ["guest@example.com"] });
  });
});
