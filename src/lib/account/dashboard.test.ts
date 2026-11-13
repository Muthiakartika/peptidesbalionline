/**
 * The dashboard's numbers on a real (in-memory) Postgres with every migration. Made-up accounts and orders only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const { getCreditsChip, getDashboardData, statusTone } = await import("./dashboard");
const loyalty = await import("@/lib/loyalty/store");

const rp = (rupiah: number) => BigInt(rupiah) * 100n;
let db: ReturnType<typeof drizzle<typeof schema>>;

const order = async (userId: string, status: (typeof schema.orders.$inferInsert)["status"], rupiah: number, daysAgo: number, quantities: number[]) => {
  const [row] = await db
    .insert(schema.orders)
    .values({
      orderKey: `wc_order_${Math.random().toString(36).slice(2, 15)}`,
      userId,
      status,
      subtotalMinor: rp(rupiah),
      totalMinor: rp(rupiah),
      billingEmail: "x@example.com",
      billing: {},
      paymentMethod: "cod",
      paymentMethodTitle: "COD",
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
    })
    .returning({ id: schema.orders.id });
  for (const quantity of quantities) await db.insert(schema.orderItems).values({ orderId: row.id, productName: "P", quantity, unitPriceMinor: 0n, lineSubtotalMinor: 0n, lineTotalMinor: 0n });
};

beforeAll(async () => {
  const pg = new PGlite();
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  db = drizzle(pg, { schema });
  state.db = db;
  await db.insert(schema.users).values([
    { id: "u-busy", name: "Busy", email: "busy@example.com" },
    { id: "u-new", name: "New", email: "new@example.com" },
  ]);
  await db.insert(schema.addresses).values({ userId: "u-busy", type: "billing", firstName: "Test Busy", address1: "Jl. Contoh 1", city: "Denpasar", postcode: "80111" });
  await order("u-busy", "completed", 2_000_000, 30, [1, 2]);
  await order("u-busy", "processing", 1_000_000, 10, [1]);
  await order("u-busy", "pending", 500_000, 5, [3]);
  await order("u-busy", "cancelled", 900_000, 3, [1]);
  await order("u-busy", "on-hold", 700_000, 2, [1, 1]);
  await order("u-busy", "completed", 300_000, 1, [4]);
}, 60_000);

describe("the dashboard's data", () => {
  it("counts orders, the ones still open and what was spent (processing and completed only)", async () => {
    const data = await getDashboardData("u-busy");
    expect(data.orderCount).toBe(6);
    expect(data.openCount).toBe(3); // processing + pending + on-hold
    expect(data.spentMinor).toBe(rp(3_300_000)); // 2,000,000 + 1,000,000 + 300,000
  });

  it("lists the latest orders newest first with their item counts", async () => {
    const data = await getDashboardData("u-busy", 3);
    expect(data.recent.map((o) => [o.status, o.items])).toEqual([["completed", 4], ["on-hold", 2], ["cancelled", 1]]);
    expect(data.recent[0].totalMinor).toBe(rp(300_000));
  });

  it("has the saved address as printable lines", async () => {
    const data = await getDashboardData("u-busy");
    expect(data.address).toEqual({ name: "Test Busy", lines: ["Jl. Contoh 1", "Denpasar 80111"] });
  });

  it("is empty for a customer with nothing yet", async () => {
    const data = await getDashboardData("u-new");
    expect(data).toEqual({ orderCount: 0, openCount: 0, spentMinor: 0n, recent: [], rewards: null, address: null });
    expect(await getCreditsChip("u-new")).toBeNull();
  });

  it("shows the rewards balance and the credits missing for the next coupon once joined", async () => {
    await loyalty.joinRewards("u-new");
    const data = await getDashboardData("u-new");
    expect(data.rewards).toEqual({ balance: 50, toNext: 200, redeemable: 0 });
    expect(await getCreditsChip("u-new")).toBe(50);
  });

  it("gives every status a colour family", () => {
    expect(["completed", "processing", "pending", "on-hold", "cancelled", "failed", "refunded"].map(statusTone)).toEqual(["done", "active", "waiting", "waiting", "bad", "bad", "muted"]);
  });
});
