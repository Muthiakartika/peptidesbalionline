/**
 * "Resend" in the temporary-password reminder: /my-account/?wc-resend-set-password=1&_wpnonce=… (src/proxy.ts
 * sends it here). As WC_Form_Handler::resend_set_password: with the session's own token, at most once a
 * minute, e-mails a new link ("Password Reset Request") and says "We have emailed you a new link to change
 * your password."; then back to My Account.
 */
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getAuth, passwordEmailResults } from "@/lib/auth";
import { encodeNotices, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, notice } from "@/lib/account/notices";
import { resendTokenFor } from "@/lib/account/session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/my-account/", request.nextUrl), 302);
  const say = (list: ReturnType<typeof notice.info>[]) => response.cookies.set(FLASH_COOKIE, encodeNotices(list), { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" });
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session || request.nextUrl.searchParams.get("_wpnonce") !== resendTokenFor(session.session.token)) return response;
    const [row] = await getDb().select({ resentAt: users.setPasswordResentAt }).from(users).where(eq(users.id, session.user.id)).limit(1);
    if (row?.resentAt && Date.now() - row.resentAt.getTime() < 60_000) {
      say([notice.info("Please wait a moment before requesting another link to change your password.")]);
      return response;
    }
    await getDb().update(users).set({ setPasswordResentAt: new Date() }).where(eq(users.id, session.user.id));
    const email = session.user.email.toLowerCase();
    passwordEmailResults.delete(email);
    await getAuth().api.requestPasswordReset({ body: { email: session.user.email, redirectTo: "/my-account/lost-password/" }, headers: request.headers });
    const result = passwordEmailResults.get(email);
    passwordEmailResults.delete(email);
    if (result === "not-sent") say([notice.error("This copy of the shop can't send e-mails yet, so the link wasn't sent.")]);
    else if (result === "saved-locally") say([notice.success("We have emailed you a new link to change your password."), notice.info("This copy of the shop doesn't send e-mails yet: the e-mail was saved in the folder .data/mail on this computer.")]);
    else say([notice.success("We have emailed you a new link to change your password.")]);
  } catch (error) {
    console.error("[resend-set-password] failed", error);
    say([notice.error("Sorry, we were unable to resend the link. Please try again.")]);
  }
  return response;
}
