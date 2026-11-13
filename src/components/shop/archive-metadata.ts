/**
 * <head> tags of every page built from WordPress content (pages, posts, products, shop and categories),
 * copied from the live site's Yoast output: title, description, canonical, robots, Open Graph with the
 * link-preview picture (og:image + its size and type) and the article dates. The picture and dates come from
 * src/content/seo/open-graph.json (scripts/audit/export-open-graph.mjs, every address of the live sitemaps,
 * 13 Nov 2026); the picture is served from the R2 bucket once NEXT_PUBLIC_MEDIA_BASE_URL is set.
 * A page that isn't in that copy (a product made in /admin/products/) can pass its own picture.
 */
import type { Metadata } from "next";

import openGraph from "@/content/seo/open-graph.json";
import type { PageSeo } from "@/lib/catalog";
import { mediaUrl } from "@/lib/media/url";
import { isProduction } from "@/lib/site";

type OgImage = { url: string; width: number | null; height: number | null; type: string | null };
type OgEntry = { ogType: string | null; robots: string | null; image?: OgImage; publishedTime?: string; modifiedTime?: string };

const LIVE = "https://peptidesbali.online";
const copied = openGraph.pages as Record<string, OgEntry>;

/** Yoast's link-preview picture and dates for an address (null when live has none for it). */
export function openGraphFor(path: string): OgEntry | null {
  return copied[path] ?? null;
}

/** A picture address as the page serves it: WordPress uploads → the bucket once pictures moved there. */
const pictureUrl = (url: string) => mediaUrl(url.startsWith("/") ? `${LIVE}${url}` : url);

/** The RSS feeds WordPress lists in every page's <head> (src/lib/seo/feeds.ts); a post also lists its comments feed. */
export function feedLinks(post?: { title: string; path: string }) {
  return [
    { url: "/feed/", title: "Atlas Longevity » Feed" },
    { url: "/comments/feed/", title: "Atlas Longevity » Comments Feed" },
    ...(post ? [{ url: `${post.path}feed/`, title: `Atlas Longevity » ${post.title} Comments Feed` }] : []),
  ];
}

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

export function archiveMetadata(
  seo: PageSeo,
  canonicalPath: string,
  ownPicture?: { src: string; width?: number; height?: number } | null,
  /** A blog post: its own comments feed is listed too. */
  post?: { title: string },
): Metadata {
  // Yoast prints no canonical link on a page that search engines may not index.
  const noindex = seo.robots?.split(",").some((part) => part.trim() === "noindex") ?? false;
  const og = openGraphFor(canonicalPath);
  const picture = og?.image ?? (ownPicture?.src ? { url: ownPicture.src, width: ownPicture.width ?? null, height: ownPicture.height ?? null, type: null } : null);
  const images = picture
    ? [{ url: pictureUrl(picture.url), ...(picture.width ? { width: picture.width } : {}), ...(picture.height ? { height: picture.height } : {}), ...(picture.type ? { type: picture.type } : {}) }]
    : undefined;
  const shared = {
    locale: "en_US",
    title: seo.ogTitle ?? seo.title,
    description: seo.ogDescription ?? seo.description ?? undefined,
    url: canonicalPath,
    siteName: "Atlas Longevity",
    ...(images ? { images } : {}),
  };
  return {
    title: seo.title,
    description: seo.description ?? undefined,
    ...(isProduction && seo.robots ? { robots: yoastRobots(seo.robots) } : {}),
    alternates: {
      ...(noindex ? {} : { canonical: canonicalPath }),
      types: { "application/rss+xml": feedLinks(post ? { title: post.title, path: canonicalPath } : undefined) },
    },
    openGraph:
      seo.ogType === "article"
        ? { ...shared, type: "article", ...(og?.publishedTime ? { publishedTime: og.publishedTime } : {}), ...(og?.modifiedTime ? { modifiedTime: og.modifiedTime } : {}) }
        : { ...shared, type: "website" },
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
