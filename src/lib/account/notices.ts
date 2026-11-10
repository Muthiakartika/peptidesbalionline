/**
 * WooCommerce's messages ("notices") for the account pages, as data instead of HTML, so they can be
 * shown safely: each message is a list of parts, text, bold text (<strong>) or a link to a page of
 * this site. Example: WordPress's "<strong>Error:</strong> The username <strong>budi</strong> is not
 * registered on this site. …" is
 *   [{ strong: "Error:" }, " The username ", { strong: "budi" }, " is not registered on this site. …"].
 *
 * After a form that goes on to another page (log in, register, save), the messages travel in a short-lived
 * cookie (FLASH_COOKIE, 60 seconds), the way WooCommerce keeps them in its session for the next page.
 * The page shows them and the browser deletes the cookie (AccountNotices.tsx). Shared by server and browser.
 */
import { z } from "zod";

export type NoticePart = string | { strong: string } | { text: string; href: string; className?: string };
export type NoticeType = "error" | "success" | "info";
export type Notice = { type: NoticeType; parts: NoticePart[] };

export const FLASH_COOKIE = "atlas_notices";
export const FLASH_MAX_AGE_SECONDS = 60;

/** Only addresses of this site ("/…" or "#"), never another site's. */
const internalHref = z.string().max(300).regex(/^(\/(?!\/)|#)/);
const part = z.union([z.string().max(500), z.object({ strong: z.string().max(300) }), z.object({ text: z.string().max(200), href: internalHref, className: z.string().max(60).optional() })]);
const notices = z.array(z.object({ type: z.enum(["error", "success", "info"]), parts: z.array(part).max(20) })).max(20);

const error = (...parts: NoticePart[]): Notice => ({ type: "error", parts });
const success = (...parts: NoticePart[]): Notice => ({ type: "success", parts });
const info = (...parts: NoticePart[]): Notice => ({ type: "info", parts });
export const notice = { error, success, info };

export function encodeNotices(list: Notice[]): string {
  return encodeURIComponent(JSON.stringify(list));
}

/** A missing, broken or changed cookie gives no messages. */
export function decodeNotices(value: string | undefined | null): Notice[] {
  if (!value) return [];
  try {
    const parsed = notices.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
