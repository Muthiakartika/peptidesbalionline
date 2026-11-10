"use client";

/**
 * The flash cookie's messages on a page that is built in advance (it can't read cookies on the server),
 * e.g. "Password reset email has been sent." after the lost-password form: read in the browser, shown
 * once, then the cookie is deleted (AccountNotices.tsx).
 */
import { useSyncExternalStore } from "react";

import { decodeNotices, FLASH_COOKIE, type Notice } from "@/lib/account/notices";

import { NoticeList } from "./AccountNotices";

const noSubscription = () => () => {};
// Read once per page load: the cookie is deleted right after, and React asks for the snapshot more than once.
let cached: Notice[] | null = null;
function read(): Notice[] {
  if (cached) return cached;
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${FLASH_COOKIE}=`))?.slice(FLASH_COOKIE.length + 1) ?? "";
  cached = decodeNotices(raw);
  if (raw) document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  return cached;
}
const none: Notice[] = [];

export function FlashNotices() {
  const notices = useSyncExternalStore(noSubscription, read, () => none);
  return notices.length ? <NoticeList notices={notices} /> : null;
}
