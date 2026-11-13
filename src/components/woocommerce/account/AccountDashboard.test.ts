/**
 * The dashboard's order list and rewards panel rendered to HTML with made-up data: what each order row offers
 * (status chip, total, Pay only when the order still needs paying), the empty state, and the rewards progress.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: () => null }));

const { RecentOrders, RewardsPanel } = await import("./AccountDashboard");
const { initials } = await import("./AccountShell");

const rp = (rupiah: number) => BigInt(rupiah) * 100n;
const order = (number: number, status: "pending" | "completed" | "cancelled" | "processing", rupiah: number, items: number) => ({
  number: BigInt(number),
  key: `wc_order_k${number}`,
  status,
  createdAt: new Date("2026-11-10T03:00:00Z"),
  totalMinor: rp(rupiah),
  items,
});
const data = (recent: ReturnType<typeof order>[]) => ({ orderCount: recent.length, openCount: 0, spentMinor: 0n, recent, rewards: null, address: null });

describe("recent orders on the dashboard", () => {
  it("shows each order with its status, total and the right buttons", () => {
    const html = renderToStaticMarkup(createElement(RecentOrders, { data: data([order(12801, "pending", 2_200_000, 1), order(12790, "completed", 4_200_000, 3), order(12780, "cancelled", 300_000, 2)]) }));
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("Order #12801");
    expect(html).toContain("Rp 2,200,000");
    expect(html).toContain("3 items");
    expect(html).toContain("1 item<");
    expect(html).toContain('data-tone="waiting">Pending payment');
    expect(html).toContain('data-tone="done">Completed');
    expect(html).toContain('data-tone="bad">Cancelled');
    // Pay only for the order that still needs paying, with its key.
    expect(html.match(/>Pay</g)).toHaveLength(1);
    // (Outside the app next/link drops the trailing slash the site config adds, so the tests accept both.)
    expect(html).toMatch(/\/checkout\/order-pay\/12801\/?\?pay_for_order=true&amp;key=wc_order_k12801/);
    expect(html).toMatch(/href="\/my-account\/orders\/?"/);
  });

  it("invites to the shop when there are no orders", () => {
    const html = renderToStaticMarkup(createElement(RecentOrders, { data: data([]) }));
    expect(html).toContain("No orders yet");
    expect(html).toMatch(/href="\/shop\/?"/);
    expect(html).not.toContain("View all");
  });
});

describe("the rewards panel", () => {
  it("offers to join when the customer isn't a member", () => {
    expect(renderToStaticMarkup(createElement(RewardsPanel, { rewards: null }))).toContain("Join free · get 50 credits");
  });

  it("shows the balance and how far the next coupon is", () => {
    const html = renderToStaticMarkup(createElement(RewardsPanel, { rewards: { balance: 470, toNext: 30, redeemable: 1 } }));
    expect(html).toContain("<strong>470</strong> credits");
    expect(html).toContain("Exchange credits");
    const partial = renderToStaticMarkup(createElement(RewardsPanel, { rewards: { balance: 50, toNext: 200, redeemable: 0 } }));
    expect(partial).toContain("200 more credits");
    expect(partial).toContain("width:20%");
  });
});

describe("the sidebar avatar", () => {
  it("uses the initials of the name", () => {
    expect(initials("Budi Santoso")).toBe("BS");
    expect(initials("local.tester")).toBe("LT");
    expect(initials("ray")).toBe("R");
    expect(initials("")).toBe("?");
  });
});
