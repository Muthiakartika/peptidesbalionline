/**
 * The rewards rules against the examples on /rewards/ ("Here's how your credits add up") and the terms.
 */
import { describe, expect, it } from "vitest";

import {
  creditsForSpend,
  eligibleSpend,
  friendCouponSpec,
  isReferralCode,
  newCouponCode,
  newReferralCode,
  redemptionCouponSpec,
  redemptionProgress,
  referrerCouponSpec,
  sharePath,
  welcomeValueRupiah,
} from "./rules";

const rp = (rupiah: number) => BigInt(rupiah) * 100n;

describe("credits for eligible spend", () => {
  it("matches the table on the rewards page", () => {
    const table: [number, number][] = [
      [500_000, 50],
      [1_000_000, 100],
      [1_500_000, 150],
      [2_000_000, 200],
      [2_500_000, 250],
      [3_000_000, 300],
      [5_000_000, 500],
    ];
    for (const [spend, credits] of table) expect(creditsForSpend(rp(spend))).toBe(credits);
  });

  it("rounds down to whole credits per order (terms §3)", () => {
    expect(creditsForSpend(rp(9_999))).toBe(0);
    expect(creditsForSpend(rp(10_000))).toBe(1);
    expect(creditsForSpend(rp(19_999))).toBe(1);
    expect(creditsForSpend(rp(2_549_999))).toBe(254);
  });

  it("earns nothing from zero or negative spend", () => {
    expect(creditsForSpend(0n)).toBe(0);
    expect(creditsForSpend(-rp(50_000))).toBe(0);
  });
});

describe("eligible spend", () => {
  it("is what the lines cost after discounts, less refunds, never below zero", () => {
    expect(eligibleSpend([rp(900_000), rp(600_000)])).toBe(rp(1_500_000));
    expect(eligibleSpend([rp(900_000), rp(600_000)], rp(500_000))).toBe(rp(1_000_000));
    expect(eligibleSpend([rp(100_000)], rp(500_000))).toBe(0n);
    expect(eligibleSpend([])).toBe(0n);
  });
});

describe("redemption progress", () => {
  it("counts whole redemptions and the credits missing for the next", () => {
    expect(redemptionProgress(0)).toEqual({ redeemable: 0, toNext: 250 });
    expect(redemptionProgress(50)).toEqual({ redeemable: 0, toNext: 200 });
    expect(redemptionProgress(250)).toEqual({ redeemable: 1, toNext: 250 });
    expect(redemptionProgress(500)).toEqual({ redeemable: 2, toNext: 250 });
    expect(redemptionProgress(750)).toEqual({ redeemable: 3, toNext: 250 });
    expect(redemptionProgress(-10)).toEqual({ redeemable: 0, toNext: 250 });
  });
});

describe("the programme's numbers", () => {
  it("makes the welcome credits worth Rp 50,000", () => {
    expect(welcomeValueRupiah()).toBe(50_000);
  });

  it("has the three coupons the pages promise", () => {
    expect(redemptionCouponSpec("rw-redeem-x")).toMatchObject({ amount: "250000.00", minimumAmountMinor: rp(2_500_000), source: "rewards_redemption" });
    expect(friendCouponSpec("rw-friend-x")).toMatchObject({ amount: "250000.00", minimumAmountMinor: rp(3_000_000), source: "rewards_referral" });
    expect(referrerCouponSpec("rw-reward-x")).toMatchObject({ amount: "250000.00", minimumAmountMinor: rp(2_500_000), source: "rewards_referral" });
  });
});

describe("codes and links", () => {
  it("makes referral codes like RewardsWP's (7 hex characters) and accepts the old ones", () => {
    expect(newReferralCode()).toMatch(/^[0-9a-f]{7}$/);
    for (const old of ["c97f2ba", "cd71644", "865873b", "0c1ece2"]) expect(isReferralCode(old)).toBe(true);
    expect(isReferralCode("x")).toBe(false);
    expect(isReferralCode("a b")).toBe(false);
    expect(isReferralCode("../etc")).toBe(false);
  });

  it("shares /share/<code>/ (RewardsWP's referral slug)", () => {
    expect(sharePath("c97f2ba")).toBe("/share/c97f2ba/");
  });

  it("makes coupon codes that are lower case and different each time", () => {
    const codes = new Set(Array.from({ length: 50 }, () => newCouponCode("redeem")));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^rw-redeem-[a-z0-9]{8}$/);
    expect(newCouponCode("friend")).toMatch(/^rw-friend-/);
    expect(newCouponCode("reward")).toMatch(/^rw-reward-/);
  });
});
