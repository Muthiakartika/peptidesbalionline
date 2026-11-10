/**
 * <head> tags of the shop, category and search pages, copied from the live site's Yoast output
 * (title, description, canonical, Open Graph). Structured data (JSON-LD) follows in Phase 4.
 */
import type { Metadata } from "next";

import type { PageSeo } from "@/lib/catalog";
import { isProduction } from "@/lib/site";

/**
 * Yoast's robots line as Next.js metadata, e.g. "noindex, follow" -> { index: false, follow: true },
 * "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" -> the same with the
 * three limits. Only used on the production site; everywhere else the whole site is noindex
 * (src/app/layout.tsx).
 */
export function yoastRobots(robots: string): NonNullable<Metadata["robots"]> {
  const parts = robots.split(",").map((part) => part.trim());
  const limit = (name: string) => parts.find((part) => part.startsWith(`${name}:`))?.slice(name.length + 1);
  const number = (value: string | undefined) => (value === undefined ? undefined : Number(value));
  return {
    index: !parts.includes("noindex"),
    follow: !parts.includes("nofollow"),
    ...(limit("max-image-preview") ? { "max-image-preview": limit("max-image-preview") as "large" | "standard" | "none" } : {}),
    ...(limit("max-snippet") !== undefined ? { "max-snippet": number(limit("max-snippet")) } : {}),
    ...(limit("max-video-preview") !== undefined ? { "max-video-preview": number(limit("max-video-preview")) } : {}),
  };
}

export function archiveMetadata(seo: PageSeo, canonicalPath: string): Metadata {
  // Yoast prints no canonical link on a page that search engines may not index.
  const noindex = seo.robots?.split(",").some((part) => part.trim() === "noindex") ?? false;
  return {
    title: seo.title,
    description: seo.description ?? undefined,
    ...(isProduction && seo.robots ? { robots: yoastRobots(seo.robots) } : {}),
    ...(noindex ? {} : { alternates: { canonical: canonicalPath } }),
    openGraph: {
      locale: "en_US",
      type: seo.ogType === "article" ? "article" : "website",
      title: seo.ogTitle ?? seo.title,
      description: seo.ogDescription ?? seo.description ?? undefined,
      url: canonicalPath,
      siteName: "Atlas Longevity",
    },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * Product search results. The live title really is "- Atlas Longevity" (Yoast's search title
 * template prints nothing before the separator), and the page is noindex.
 */
export const searchMetadata: Metadata = {
  title: "- Atlas Longevity",
  ...(isProduction ? { robots: { index: false, follow: true } } : {}),
};
