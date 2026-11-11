/**
 * What a post card on /insights/ and under each post needs: plain values only, so the cards can be
 * handed to the browser part of the page (the topic filter and search, InsightsLibrary.tsx).
 * Built on the server by src/lib/blog/insights.ts.
 */
export type InsightImage = { src: string; srcset?: string; sizes?: string; width: number; height: number; alt: string };

export type InsightCardData = {
  id: number;
  path: string;
  title: string;
  /** Plain text (no HTML), already shortened by WordPress. */
  excerpt: string;
  /** "November 11, 2026" */
  date: string;
  /** "2026-11-11" (for <time dateTime>) */
  isoDate: string;
  readMinutes: number;
  /** The post's first category, or null for "Uncategorized" posts. */
  topic: { slug: string; name: string; path: string } | null;
  /** All its category slugs (the topic filter uses them). */
  topicSlugs: string[];
  image: InsightImage | null;
  /** True while the post still uses a stand-in picture shared with other posts (see posts.json
   *  "placeholderImage"): the cards then draw a typographic cover instead of repeating it. */
  placeholderImage: boolean;
};

export type InsightTopic = { slug: string; name: string; count: number };
