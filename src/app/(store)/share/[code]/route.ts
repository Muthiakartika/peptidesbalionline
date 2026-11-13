/**
 * /share/<code>/: a member's "refer a friend" link (RewardsWP's referral slug was "share", so the links
 * members already sent keep working). A real member's code is remembered for 30 days in a cookie, then the
 * visitor goes to the Rewards tab (the login / registration forms for a visitor), where a new customer
 * can claim their Rp 250,000 coupon. An unknown code is ignored: the visitor just lands on the homepage.
 * Rules: src/lib/loyalty/rules.ts.
 */
import { NextResponse, type NextRequest } from "next/server";

import { encodeNotices, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, notice } from "@/lib/account/notices";
import { findMemberByCode } from "@/lib/loyalty/store";
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/loyalty/rules";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let known = false;
  if (isReferralCode(code)) {
    try {
      known = Boolean(await findMemberByCode(code));
    } catch (error) {
      console.error("[rewards] share link: database error", error instanceof Error ? error.message : "error");
    }
  }
  if (!known) return NextResponse.redirect(new URL("/", request.nextUrl), 302);

  const response = NextResponse.redirect(new URL("/my-account/rewards/", request.nextUrl), 302);
  response.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), { path: "/", maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60, sameSite: "lax", httpOnly: true });
  response.cookies.set(
    FLASH_COOKIE,
    encodeNotices([notice.info("A friend invited you to Atlas Longevity Rewards. Log in or create an account, then claim your Rp 250,000 OFF coupon for a first order of Rp 3,000,000 or more.")]),
    { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" },
  );
  return response;
}
