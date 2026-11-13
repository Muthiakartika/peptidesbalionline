/**
 * WordPress's RSS feeds, as the live site prints them (read 13 Nov 2026), so feed readers and the sites that
 * follow /feed/ keep working after the move:
 *   /feed/                the 10 newest posts: title, link, date, categories, a short description with Yoast's
 *                         "The post … appeared first on …" line, the whole text (content:encoded);
 *   /comments/feed/       the comments feed (empty here: comments aren't part of the rebuild, Q-41);
 *   /<post>/feed/         a post's comments feed (empty, as on live), via src/proxy.ts.
 * Each item's guid stays WordPress's own ("https://peptidesbali.online/?p=<id>", not a link), so a reader
 * doesn't show the posts again as new ones. Posts that are drafts on live (wpStatus) are left out, as there.
 * The author is "Atlas Longevity" (live prints an e-mail address there, Q-14). Pictures in the text are served
 * from the R2 bucket once NEXT_PUBLIC_MEDIA_BASE_URL is set.
 */
import "server-only";

import { getAllPosts, getCategoryById, getPostBySlug, getPostHtml, type BlogPost } from "@/lib/blog/data";
import { mediaUrl, rewriteMediaUrls } from "@/lib/media/url";
import { business, siteUrl } from "@/lib/site";

const LIVE = "https://peptidesbali.online";
const site = siteUrl.replace(/\/$/, "");
/** The WordPress "Site Icon" at 32px, as the feed's picture. */
const ICON = mediaUrl(`${LIVE}/wp-content/uploads/2026/08/cropped-ChatGPT-Image-Aug-8-2026-11_30_34-PM-32x32.png`);
export const FEED_ITEMS = 10;

export const FEED_HEADERS = { "Content-Type": "application/rss+xml; charset=UTF-8" };
/** The comments feeds aren't pages for search results (Yoast's header on them). */
export const COMMENTS_FEED_HEADERS = { ...FEED_HEADERS, "X-Robots-Tag": "noindex, follow" };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** WordPress names are stored HTML-escaped ("Recovery &amp; Performance"); inside CDATA they are plain text. */
const plain = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const cdata = (text: string) => `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** A WordPress date (UTC on this site, e.g. "2026-08-16T11:19:43") as RSS writes it: "Sun, 16 Aug 2026 11:19:43 +0000". */
export function rssDate(date: string): string {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`).toUTCString().replace("GMT", "+0000");
}

/** The posts published on live, newest first. */
export function publishedPosts(): BlogPost[] {
  return getAllPosts()
    .filter((post) => (post as BlogPost & { wpStatus?: string }).wpStatus !== "draft")
    .sort((a, b) => b.date.localeCompare(a.date));
}

const channelHead = (title: string, self: string, link: string, lastBuild: string) =>
  `\t<title>${escape(title)}</title>\n\t<atom:link href="${escape(self)}" rel="self" type="application/rss+xml" />\n\t<link>${escape(link)}</link>\n\t<description></description>\n\t<lastBuildDate>${lastBuild}</lastBuildDate>\n\t<language>en-US</language>\n\t<sy:updatePeriod>\n\thourly\t</sy:updatePeriod>\n\t<sy:updateFrequency>\n\t1\t</sy:updateFrequency>\n`;

/** /feed/ */
export async function postsFeedXml(): Promise<string> {
  const posts = publishedPosts();
  const newest = posts.reduce((max, post) => (post.modified > max ? post.modified : max), "");
  const items = await Promise.all(
    posts.slice(0, FEED_ITEMS).map(async (post) => {
      const link = `${site}${post.path}`;
      const html = rewriteMediaUrls(await getPostHtml(post.slug));
      const excerpt = post.card.excerptHtml.replace(/\s+/g, " ").trim();
      const description = `<p>${excerpt}</p>\n<p>The post <a href="${escape(link)}">${escape(post.title)}</a> appeared first on <a href="${escape(site)}">${escape(business.name)}</a>.</p>\n`;
      const categories = post.categories.map((id) => getCategoryById(id)?.name).filter((name): name is string => Boolean(name)).map(plain);
      return [
        `\t<item>`,
        `\t\t<title>${escape(post.title)}</title>`,
        `\t\t<link>${escape(link)}</link>`,
        `\t\t<dc:creator>${cdata(business.name)}</dc:creator>`,
        `\t\t<pubDate>${rssDate(post.date)}</pubDate>`,
        ...categories.map((name) => `\t\t<category>${cdata(name)}</category>`),
        `\t\t<guid isPermaLink="false">${LIVE}/?p=${post.id}</guid>`,
        `\t\t<description>${cdata(description)}</description>`,
        `\t\t<content:encoded>${cdata(html)}</content:encoded>`,
        `\t\t<wfw:commentRss>${escape(`${link}feed/`)}</wfw:commentRss>`,
        `\t\t<slash:comments>0</slash:comments>`,
        `\t</item>`,
      ].join("\n");
    }),
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"\n\txmlns:content="http://purl.org/rss/1.0/modules/content/"\n\txmlns:wfw="http://wellformedweb.org/CommentAPI/"\n\txmlns:dc="http://purl.org/dc/elements/1.1/"\n\txmlns:atom="http://www.w3.org/2005/Atom"\n\txmlns:sy="http://purl.org/rss/1.0/modules/syndication/"\n\txmlns:slash="http://purl.org/rss/1.0/modules/slash/"\n\t>\n\n<channel>\n` +
    channelHead(business.name, `${site}/feed/`, `${site}/`, newest ? rssDate(newest) : rssDate(new Date(0).toISOString())) +
    `\n<image>\n\t<url>${escape(ICON)}</url>\n\t<title>${escape(business.name)}</title>\n\t<link>${escape(`${site}/`)}</link>\n\t<width>32</width>\n\t<height>32</height>\n</image>\n` +
    `${items.join("\n")}\n</channel>\n</rss>\n`
  );
}

const commentsFeed = (title: string, self: string, link: string, lastBuild: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"\n\txmlns:content="http://purl.org/rss/1.0/modules/content/"\n\txmlns:dc="http://purl.org/dc/elements/1.1/"\n\txmlns:atom="http://www.w3.org/2005/Atom"\n\txmlns:sy="http://purl.org/rss/1.0/modules/syndication/"\n\t\n\t>\n<channel>\n` +
  channelHead(title, self, link, lastBuild) +
  `</channel>\n</rss>\n`;

/** /comments/feed/ */
export function commentsFeedXml(): string {
  const newest = publishedPosts().reduce((max, post) => (post.modified > max ? post.modified : max), "");
  return commentsFeed(`Comments for ${business.name}`, `${site}/comments/feed/`, `${site}/`, rssDate(newest || new Date(0).toISOString()));
}

/** /<post>/feed/ (null for an address that isn't a post). */
export function postCommentsFeedXml(slug: string): string | null {
  const post = getPostBySlug(slug);
  if (!post) return null;
  return commentsFeed(`Comments on: ${post.title}`, `${site}${post.path}feed/`, `${site}${post.path}`, rssDate(post.modified));
}
