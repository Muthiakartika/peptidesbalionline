/**
 * Who is logged in (server code only), from Better Auth's session cookie:
 *
 *   const user = await getAccountUser();   // null for a visitor
 *
 * Also the logout link's token (WordPress's _wpnonce on "Log out"): a logout link only works with the
 * token of the visitor's own session, so another site can't log people out with a hidden link. The token is
 * also kept in a cookie the browser can read (ACCOUNT_COOKIE), so the static header can show the logged-in
 * menu with a working "Logout" without asking the server; it says nothing else about the account.
 */
import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export { ACCOUNT_COOKIE } from "./account-cookie";

export type AccountUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  /** WordPress's display name ("Hello <display name>"). */
  displayName: string;
  firstName: string;
  lastName: string;
  /** The token for this session's logout link. */
  logoutToken: string;
  /** The session cookie's token (server code only: other links' tokens are made from it, never sent out). */
  sessionToken: string;
  /** Still the password made up at registration (WooCommerce's "default_password_nag"). */
  temporaryPassword: boolean;
  /** When "Resend" last e-mailed a link, or null. */
  setPasswordResentAt: Date | null;
  /** WordPress's role: "customer", "shop_manager" or "administrator". */
  role: string;
};

/** The shop's staff (WooCommerce's "manage_woocommerce"): administrators and shop managers. */
export const isStaff = (user: AccountUser | null) => user?.role === "administrator" || user?.role === "shop_manager";

/** The "Resend" link's token (WooCommerce's _wpnonce for wc-resend-set-password). */
export function resendTokenFor(sessionToken: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(`wc-resend-set-password|${sessionToken}`).digest("hex").slice(0, 10);
}

/** A short token for this session (10 hex characters, like a WordPress nonce). */
export function logoutTokenFor(sessionToken: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(`customer-logout|${sessionToken}`).digest("hex").slice(0, 10);
}

export async function getAccountUser(): Promise<AccountUser | null> {
  const result = await getAuth().api.getSession({ headers: await headers() });
  if (!result) return null;
  const { user, session } = result;
  const extra = user as typeof user & { username?: string | null; firstName?: string | null; lastName?: string | null; temporaryPassword?: boolean | null; setPasswordResentAt?: Date | string | null; role?: string | null };
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    username: extra.username ?? "",
    displayName: user.name,
    firstName: extra.firstName ?? "",
    lastName: extra.lastName ?? "",
    logoutToken: logoutTokenFor(session.token),
    sessionToken: session.token,
    temporaryPassword: extra.temporaryPassword === true,
    setPasswordResentAt: extra.setPasswordResentAt ? new Date(extra.setPasswordResentAt) : null,
    role: extra.role ?? "customer",
  };
}
