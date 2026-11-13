"use server";

/**
 * The Rewards tab's buttons (Server Actions): join, exchange 250 credits for a coupon, claim a friend's coupon.
 * Each one does its work, leaves its message in the flash cookie (src/lib/account/notices.ts) and goes back to
 * the tab, like the other account forms. The rules are in src/lib/loyalty/rules.ts.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { encodeNotices, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, notice, type Notice } from "@/lib/account/notices";
import { getAccountUser } from "@/lib/account/session";
import { claimFriendCoupon, joinRewards, redeemCredits, type ClaimResult } from "@/lib/loyalty/store";
import { isReferralCode, REDEEM_CREDITS, REFERRAL_COOKIE, WELCOME_CREDITS } from "@/lib/loyalty/rules";

const BACK = "/my-account/rewards/";

async function flash(list: Notice[]) {
  if (list.length) (await cookies()).set(FLASH_COOKIE, encodeNotices(list), { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" });
}

async function requireUser() {
  const user = await getAccountUser().catch(() => null);
  if (!user) redirect("/my-account/");
  return user;
}

const unavailable = () => notice.error({ strong: "Error:" }, " Rewards aren't available right now. Please try again in a moment.");

/** What to tell the customer about their friend's coupon. */
function claimNotice(result: ClaimResult): Notice {
  if (result.ok) {
    return notice.success(`Your friend's coupon is ready: ${result.code}. Enter it in the coupon box at checkout for Rp 250,000 OFF a first order of Rp 3,000,000 or more.`);
  }
  switch (result.reason) {
    case "own-link":
      return notice.error("You can't use your own referral link.");
    case "not-new":
      return notice.error("The friend coupon is for new customers: your account or e-mail address already has an order.");
    case "already-claimed":
      return notice.info("You have already claimed a friend's coupon.");
    default:
      return notice.error("That referral link isn't valid any more.");
  }
}

/** The code of the friend's link remembered in the cookie, if there is one. */
async function referralCookie(): Promise<string | null> {
  const value = (await cookies()).get(REFERRAL_COOKIE)?.value ?? "";
  return isReferralCode(value) ? value : null;
}

async function claimFromCookie(userId: string, notices: Notice[]) {
  const code = await referralCookie();
  if (!code) return;
  const result = await claimFriendCoupon(userId, code);
  notices.push(claimNotice(result));
  // The link has done its work, whatever the answer: it isn't tried again.
  (await cookies()).delete(REFERRAL_COOKIE);
}

/** "Join free": the welcome credits, and the friend's coupon when the customer came through a share link. */
export async function joinRewardsAction() {
  const user = await requireUser();
  const notices: Notice[] = [];
  try {
    const joined = await joinRewards(user.id);
    notices.push(
      joined.created
        ? notice.success(`Welcome to Atlas Longevity Rewards! We added ${WELCOME_CREDITS} credits to your account.`)
        : notice.info("You are already a member of Atlas Longevity Rewards."),
    );
    await claimFromCookie(user.id, notices);
  } catch (error) {
    console.error("[rewards] join failed", error instanceof Error ? error.message : "error");
    notices.push(unavailable());
  }
  await flash(notices);
  redirect(BACK);
}

/** 250 credits → a Rp 250,000 coupon. */
export async function redeemCreditsAction() {
  const user = await requireUser();
  const notices: Notice[] = [];
  try {
    const result = await redeemCredits(user.id);
    if (result.ok) {
      notices.push(notice.success(`Your coupon is ready: ${result.code}. Enter it in the coupon box at checkout for Rp 250,000 OFF an order of Rp 2,500,000 or more.`));
    } else if (result.reason === "not-a-member") {
      notices.push(notice.error("Join Atlas Longevity Rewards first."));
    } else {
      notices.push(notice.error(`You need ${REDEEM_CREDITS} credits to redeem a coupon.`));
    }
  } catch (error) {
    console.error("[rewards] redeem failed", error instanceof Error ? error.message : "error");
    notices.push(unavailable());
  }
  await flash(notices);
  redirect(BACK);
}

/** "Claim Rp 250,000 OFF": the friend's coupon for the share link in the cookie. */
export async function claimFriendCouponAction() {
  const user = await requireUser();
  const notices: Notice[] = [];
  try {
    if (!(await referralCookie())) notices.push(notice.error("Open your friend's referral link first, then claim your coupon."));
    else await claimFromCookie(user.id, notices);
  } catch (error) {
    console.error("[rewards] claim failed", error instanceof Error ? error.message : "error");
    notices.push(unavailable());
  }
  await flash(notices);
  redirect(BACK);
}
