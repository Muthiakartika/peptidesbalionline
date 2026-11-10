/**
 * The "logged in" cookie the browser can read (like WordPress's wordpress_logged_in_ cookie, but holding
 * only the logout link's token): set when logging in or registering, removed when logging out
 * (src/app/(store)/my-account/actions.ts, customer-logout/route.ts) and by src/proxy.ts when the session
 * cookie is gone. The header reads it to show the account menu (src/components/layout/header/AccountMenu.tsx).
 */
export const ACCOUNT_COOKIE = "atlas_account";

/** Better Auth's session cookie (with the __Secure- prefix on https). */
export const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/** In the browser: the logout token when the visitor is logged in, else null. */
export function readAccountTokenInBrowser(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${ACCOUNT_COOKIE}=`));
  const value = match ? decodeURIComponent(match.slice(ACCOUNT_COOKIE.length + 1)) : "";
  return /^[0-9a-f]{10}$/.test(value) ? value : null;
}
