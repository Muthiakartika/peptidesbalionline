/**
 * Site settings from Sanity over the defaults in src/content/site-chrome.ts: a text or list left empty
 * in Sanity keeps the default, so a half-filled Site settings document never blanks the header.
 * Sanity's own fields (_key, _type) and empty values are dropped.
 */
import { ageGate, announcements, cookieNotice, footer, mainMenu, type AgeGateContent, type Announcement, type CookieNoticeContent, type FooterContent, type NavLink } from "@/content/site-chrome";

export type SiteChrome = { announcements: Announcement[]; mainMenu: NavLink[]; footer: FooterContent; ageGate: AgeGateContent; cookieNotice: CookieNoticeContent };

export const defaultSiteChrome: SiteChrome = { announcements, mainMenu, footer, ageGate, cookieNotice };

/** Without Sanity's bookkeeping fields and without null / "" values. */
export function stripSanity<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripSanity(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith("_") || item === null || item === undefined || item === "") continue;
      out[key] = stripSanity(item);
    }
    return out as T;
  }
  return value;
}

const list = <T>(value: unknown, fallback: T[]): T[] => (Array.isArray(value) && value.length ? (stripSanity(value) as T[]) : fallback);

function merge<T extends object>(fallback: T, value: unknown): T {
  if (!value || typeof value !== "object") return fallback;
  const out = { ...fallback } as Record<string, unknown>;
  for (const [key, item] of Object.entries(stripSanity(value) as Record<string, unknown>)) {
    const base = out[key];
    if (Array.isArray(base)) out[key] = list(item, base);
    else if (base && typeof base === "object") out[key] = merge(base as object, item);
    else if (typeof item === typeof base || base === undefined) out[key] = item;
  }
  return out as T;
}

/** The Site settings document (or null) → what the header, footer and notices show. */
export function siteChromeFrom(settings: Partial<Record<keyof SiteChrome, unknown>> | null | undefined): SiteChrome {
  if (!settings) return defaultSiteChrome;
  return {
    announcements: list(settings.announcements, announcements),
    mainMenu: list(settings.mainMenu, mainMenu),
    footer: merge(footer, settings.footer),
    ageGate: merge(ageGate, settings.ageGate),
    cookieNotice: merge(cookieNotice, settings.cookieNotice),
  };
}
