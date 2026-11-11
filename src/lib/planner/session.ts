/**
 * GET /session of the planner API and its "nonce": the first thing planner.js asks for. The answer
 * says who the visitor is (only whether they are logged in), which features are on, the limits,
 * the currency, today's date and this site's pages. It also carries the nonces: planner.js sends
 * `nonce` back as "X-ARP-Nonce" with every later request, and the routes that calculate or change
 * something (calculate, cart, exports) refuse a request without a valid one, as WordPress does
 * ("arp_bad_nonce"; the script then asks for a new session once and tries again). Another site can't
 * read the nonce, so it can't make a visitor's browser change their cart.
 *
 * A nonce here is like a WordPress nonce: 10 hex characters, an HMAC of the visitor (0 for a guest)
 * and the current half day, valid for that half day and the one before (12–24 hours).
 *
 * Saved protocols, share links and the WhatsApp hand-off are off on this site for now (they need
 * accounts tables of their own), so the session reports them off and the script doesn't offer them.
 */
import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIES } from "@/lib/account/account-cookie";
import { getAccountUser } from "@/lib/account/session";

import { PLANNER_FEATURES, PLANNER_URLS } from "./config";
import { plannerSettings } from "./data";

// Without BETTER_AUTH_SECRET (a local copy without accounts) the nonces still work, for as long as
// the server runs.
const secret = process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("hex");
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

function nonceFor(action: string, userId: string, tick: number): string {
  return createHmac("sha256", secret).update(`${action}|${userId}|${tick}`).digest("hex").slice(0, 10);
}

export function createNonce(action: string, userId: string, now = Date.now()): string {
  return nonceFor(action, userId, Math.ceil(now / HALF_DAY_MS));
}

export function verifyNonce(action: string, userId: string, nonce: string | null, now = Date.now()): boolean {
  if (!nonce) return false;
  const tick = Math.ceil(now / HALF_DAY_MS);
  return nonce === nonceFor(action, userId, tick) || nonce === nonceFor(action, userId, tick - 1);
}

/** The logged-in customer's id, or "0" for a visitor (also when accounts can't be read). */
export async function visitorId(): Promise<string> {
  // No session cookie: a visitor, without asking the accounts database.
  const jar = await cookies();
  if (!SESSION_COOKIES.some((name) => jar.has(name))) return "0";
  try {
    return (await getAccountUser())?.id ?? "0";
  } catch {
    return "0";
  }
}

/** Whether a request carries the visitor's valid planner nonce ("X-ARP-Nonce"). */
export async function hasValidNonce(request: Request): Promise<boolean> {
  return verifyNonce("arp_public", await visitorId(), request.headers.get("x-arp-nonce"));
}

/**
 * GET /session. Like live, a logged-in visitor is recognised only when the request comes from this
 * site's own script (the "X-ARP-Session: 1" header, which another site can't send).
 */
export async function sessionResponse(request: Request, now = new Date()) {
  const userId = request.headers.get("x-arp-session") === "1" ? await visitorId() : "0";
  return {
    nonce: createNonce("arp_public", userId, now.getTime()),
    rest_nonce: createNonce("wp_rest", userId, now.getTime()),
    user: { logged_in: userId !== "0" },
    features: PLANNER_FEATURES,
    limits: plannerSettings.limits,
    currency: plannerSettings.currency,
    locale: plannerSettings.locale,
    // The shop's time zone is UTC (live: "+00:00").
    today: now.toISOString().slice(0, 10),
    timezone: plannerSettings.timezone,
    urls: { cart: PLANNER_URLS.cart, checkout: PLANNER_URLS.checkout, planner: PLANNER_URLS.planner, login: PLANNER_URLS.login },
    store_protocols: { can_publish: false },
  };
}
