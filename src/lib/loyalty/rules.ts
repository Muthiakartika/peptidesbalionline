/**
 * The rewards programme's rules, as published on /rewards/ and /rewards-terms/ (read 12 Nov 2026) and as
 * RewardsWP Pro 1.7.1 was set up on live (its settings in the WordPress export): pure functions and
 * numbers, no database, so they are easy to test and to change in one place. Money is in minor units like
 * everywhere else (Rp 1 = 100, src/lib/money.ts).
 *
 *   * 1 credit for every Rp 10,000 of eligible product spend: after discounts, without shipping, fees or
 *     tax; rounded down per completed order (terms §3). Credits are issued once the order is completed.
 *   * 250 credits can be exchanged for a Rp 250,000 coupon; it needs an order of at least Rp 2,500,000
 *     before the discount (terms §4).
 *   * Joining is free and gives a welcome reward of Rp 50,000. RewardsWP's data shows it ran as 50
 *     credits ("signup" points), so it is 50 credits here too: worth Rp 50,000 once it is exchanged.
 *   * Refer a friend: the friend gets Rp 250,000 off a first order of at least Rp 3,000,000; when that
 *     order is completed the member gets a Rp 250,000 coupon (order of at least Rp 2,500,000).
 *   * Nothing expires (terms §5). RewardsWP's own setting said "+3 months": the published terms win.
 *   * One coupon per order: every reward coupon is "individual use", so it never combines with another.
 */
import { randomBytes } from "node:crypto";

/** Rp 1 in minor units. */
const RUPIAH = 100n;

/** Eligible product spend that earns one credit: Rp 10,000. */
export const CREDIT_SPEND_MINOR = 10_000n * RUPIAH;
/** The credits one redemption takes, and what it is worth: Rp 250,000. */
export const REDEEM_CREDITS = 250;
export const REDEEM_VALUE_RUPIAH = 250_000;
/** The smallest order (before the discount) a redemption coupon works on: Rp 2,500,000. */
export const REDEEM_MIN_ORDER_MINOR = 2_500_000n * RUPIAH;
/** Credits for joining. */
export const WELCOME_CREDITS = 50;

/** The friend's coupon: Rp 250,000 off a first order of at least Rp 3,000,000. */
export const FRIEND_REWARD_RUPIAH = 250_000;
export const FRIEND_MIN_ORDER_MINOR = 3_000_000n * RUPIAH;
/** The referrer's coupon once the friend's order is completed: Rp 250,000 off an order of at least Rp 2,500,000. */
export const REFERRER_REWARD_RUPIAH = 250_000;
export const REFERRER_MIN_ORDER_MINOR = 2_500_000n * RUPIAH;

/** The share link's first part (RewardsWP's "referral_slug" was "share") and how long it is remembered. */
export const SHARE_SEGMENT = "share";
export const REFERRAL_COOKIE = "atlas_rw_ref";
export const REFERRAL_COOKIE_DAYS = 30;

/** Orders that count: credits are issued when an order is completed, taken back when it isn't any more. */
export const EARNING_STATUS = "completed";

/** Credits for eligible spend (whole credits, rounded down). Negative or zero spend earns nothing. */
export function creditsForSpend(spendMinor: bigint): number {
  return spendMinor > 0n ? Number(spendMinor / CREDIT_SPEND_MINOR) : 0;
}

/**
 * The eligible spend of an order: what its product lines cost after coupons, less what was refunded.
 * Shipping, fees and tax are not part of the lines, so they never count.
 */
export function eligibleSpend(lineTotalsMinor: bigint[], refundedMinor = 0n): bigint {
  const spend = lineTotalsMinor.reduce((sum, line) => sum + line, 0n) - refundedMinor;
  return spend > 0n ? spend : 0n;
}

/** The Rp 50,000 shown on the pages for the welcome credits. */
export const welcomeValueRupiah = () => WELCOME_CREDITS * (REDEEM_VALUE_RUPIAH / REDEEM_CREDITS);

/** How far a balance is from the next redemption: { redeemable: whole redemptions possible, toNext: credits missing for the next one }. */
export function redemptionProgress(balance: number): { redeemable: number; toNext: number } {
  const credits = Math.max(0, Math.floor(balance));
  return { redeemable: Math.floor(credits / REDEEM_CREDITS), toNext: REDEEM_CREDITS - (credits % REDEEM_CREDITS) };
}

/** The share link of a member's referral code. */
export const sharePath = (code: string) => `/${SHARE_SEGMENT}/${code}/`;

/** A referral code is 3–32 letters and digits (RewardsWP's are 7 hex characters). */
export const isReferralCode = (value: string) => /^[a-z0-9]{3,32}$/i.test(value);

/** A new referral code like RewardsWP's: 7 lower-case hex characters. */
export const newReferralCode = () => randomBytes(4).toString("hex").slice(0, 7);

/** A coupon code made of a prefix and 8 random lower-case letters and digits ("rw-redeem-k3x9f2ab"). */
export function newCouponCode(kind: "redeem" | "friend" | "reward"): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `rw-${kind}-${suffix}`;
}

/**
 * What each reward coupon looks like in `coupons`: money off the cart (fixed_cart), used once, only by
 * its owner's e-mail address, "individual use" (one coupon per order), no expiry.
 */
export type RewardCouponSpec = {
  code: string;
  amount: string;
  minimumAmountMinor: bigint;
  description: string;
  source: "rewards_redemption" | "rewards_referral";
};

const rupiahAmount = (rupiah: number) => `${rupiah}.00`;

export function redemptionCouponSpec(code: string): RewardCouponSpec {
  return { code, amount: rupiahAmount(REDEEM_VALUE_RUPIAH), minimumAmountMinor: REDEEM_MIN_ORDER_MINOR, description: `Rewards: ${REDEEM_CREDITS} credits redeemed`, source: "rewards_redemption" };
}

export function friendCouponSpec(code: string): RewardCouponSpec {
  return { code, amount: rupiahAmount(FRIEND_REWARD_RUPIAH), minimumAmountMinor: FRIEND_MIN_ORDER_MINOR, description: "Rewards: refer a friend, the friend's coupon", source: "rewards_referral" };
}

export function referrerCouponSpec(code: string): RewardCouponSpec {
  return { code, amount: rupiahAmount(REFERRER_REWARD_RUPIAH), minimumAmountMinor: REFERRER_MIN_ORDER_MINOR, description: "Rewards: refer a friend, the member's reward", source: "rewards_referral" };
}
