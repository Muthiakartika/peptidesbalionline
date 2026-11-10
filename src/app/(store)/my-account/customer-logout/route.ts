/**
 * /my-account/customer-logout/ for a logged-in customer (a visitor without a session gets the login page
 * here, src/proxy.ts). As WooCommerce:
 *   * with the session's own token (?_wpnonce=…, the "Logout" links): logs out, back to /my-account/;
 *   * without it, or with a wrong one: back to /my-account/ with "Are you sure you want to log out?
 *     Confirm and log out", so a link on another site can't log anyone out.
 */
import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { ACCOUNT_COOKIE } from "@/lib/account/account-cookie";
import { encodeNotices, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, notice } from "@/lib/account/notices";
import { logoutTokenFor } from "@/lib/account/session";

export async function GET(request: NextRequest) {
  const target = new URL("/my-account/", request.nextUrl);
  const response = NextResponse.redirect(target, 302);
  let session: Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>> = null;
  try {
    session = await getAuth().api.getSession({ headers: request.headers });
  } catch (error) {
    console.error("[account] logout: database error", error);
  }
  if (!session) {
    response.cookies.delete(ACCOUNT_COOKIE);
    return response;
  }
  const token = logoutTokenFor(session.session.token);
  if (request.nextUrl.searchParams.get("_wpnonce") !== token) {
    const confirm = notice.success("Are you sure you want to log out? ", { text: "Confirm and log out", href: `/my-account/customer-logout/?_wpnonce=${token}` });
    response.cookies.set(FLASH_COOKIE, encodeNotices([confirm]), { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" });
    return response;
  }
  const signedOut = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
  for (const cookie of signedOut.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  response.cookies.delete(ACCOUNT_COOKIE);
  return response;
}
