/**
 * What the My Account dashboard shows about a customer (server code only): their order counts and spending, the
 * latest orders, the rewards balance and the saved billing address. Three small queries; any problem is the caller's
 * to handle (the dashboard falls back to a plain welcome).
 */
import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { addresses, orders } from "@/db/schema";
import { balanceOf, findMember } from "@/lib/loyalty/store";
import { redemptionProgress } from "@/lib/loyalty/rules";

// "In progress" = pending, on-hold and processing (still to be paid or delivered); "spent" = processing and completed.

export type DashboardOrder = { number: bigint; key: string; status: (typeof orders.$inferSelect)["status"]; createdAt: Date; totalMinor: bigint; items: number };
export type DashboardData = {
  orderCount: number;
  openCount: number;
  spentMinor: bigint;
  recent: DashboardOrder[];
  /** null: the customer hasn't joined the rewards programme. */
  rewards: { balance: number; toNext: number; redeemable: number } | null;
  /** The saved billing address as printable lines, or null. */
  address: { name: string; lines: string[] } | null;
};

export async function getDashboardData(userId: string, recentLimit = 4): Promise<DashboardData> {
  const db = getDb();
  const [[totals], recent, member, [billing]] = await Promise.all([
    db
      .select({
        orderCount: sql<number>`count(*)::int`,
        openCount: sql<number>`(count(*) filter (where ${orders.status} in ('pending', 'on-hold', 'processing')))::int`,
        spent: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} in ('processing', 'completed')), 0)::text`,
      })
      .from(orders)
      .where(eq(orders.userId, userId)),
    db
      .select({
        number: orders.orderNumber,
        key: orders.orderKey,
        status: orders.status,
        createdAt: orders.createdAt,
        totalMinor: orders.totalMinor,
        // Written out in full: inside a sub-select drizzle prints column names without their table.
        items: sql<number>`coalesce((select sum(oi.quantity) from order_items oi where oi.order_id = "orders"."id"), 0)::int`,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(recentLimit),
    findMember(db, userId),
    db
      .select({ firstName: addresses.firstName, lastName: addresses.lastName, address1: addresses.address1, address2: addresses.address2, city: addresses.city, state: addresses.state, postcode: addresses.postcode })
      .from(addresses)
      .where(and(eq(addresses.userId, userId), eq(addresses.type, "billing")))
      .limit(1),
  ]);

  let rewards: DashboardData["rewards"] = null;
  if (member) {
    const balance = await balanceOf(db, userId);
    const progress = redemptionProgress(balance);
    rewards = { balance, toNext: progress.toNext, redeemable: progress.redeemable };
  }

  const name = billing ? [billing.firstName, billing.lastName].filter(Boolean).join(" ") : "";
  const lines = billing ? [billing.address1, billing.address2, [billing.city, billing.postcode].filter(Boolean).join(" ")].filter((line): line is string => Boolean(line)) : [];
  return {
    orderCount: totals?.orderCount ?? 0,
    openCount: totals?.openCount ?? 0,
    spentMinor: BigInt(totals?.spent ?? 0),
    recent,
    rewards,
    address: billing && (name || lines.length) ? { name, lines } : null,
  };
}

/** The sidebar's credits chip: the balance of a member, null for everyone else. */
export async function getCreditsChip(userId: string): Promise<number | null> {
  const db = getDb();
  return (await findMember(db, userId)) ? balanceOf(db, userId) : null;
}

/** Status → the colour family of its chip (CSS `data-tone`). */
export function statusTone(status: string): "done" | "active" | "waiting" | "bad" | "muted" {
  if (status === "completed") return "done";
  if (status === "processing") return "active";
  if (status === "pending" || status === "on-hold") return "waiting";
  if (status === "cancelled" || status === "failed") return "bad";
  return "muted";
}
