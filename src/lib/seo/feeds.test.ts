/**
 * WordPress's RSS feeds (src/lib/seo/feeds.ts): the 10 newest published posts (drafts on live left out), the
 * guid kept as WordPress's, readable category names, RSS dates, and the empty comments feeds.
 */
import { describe, expect, it } from "vitest";

import { commentsFeedXml, postCommentsFeedXml, postsFeedXml, publishedPosts, rssDate } from "./feeds";

describe("RSS feeds", () => {
  it("writes dates as RSS does", () => {
    expect(rssDate("2026-08-16T11:19:43")).toBe("Sun, 16 Aug 2026 11:19:43 +0000");
  });

  it("lists the 10 newest published posts with WordPress's guid", async () => {
    const posts = publishedPosts();
    expect(posts.every((post) => (post as typeof post & { wpStatus?: string }).wpStatus !== "draft")).toBe(true);
    const xml = await postsFeedXml();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    expect(items).toHaveLength(10);
    expect(items[0]).toContain(`<link>${xml.match(/<link>([^<]+)<\/link>/)![1].replace(/\/$/, "")}${posts[0].path}</link>`);
    expect(items[0]).toContain(`<guid isPermaLink="false">https://peptidesbali.online/?p=${posts[0].id}</guid>`);
    expect(items[0]).toContain("<dc:creator><![CDATA[Atlas Longevity]]></dc:creator>");
    expect(xml).not.toMatch(/@gmail\.com/);
    expect(xml).not.toMatch(/<category><!\[CDATA\[[^\]]*&amp;/);
    expect(xml).toMatch(/appeared first on <a href="[^"]+">Atlas Longevity<\/a>/);
  });

  it("answers the comments feeds without comments, and no feed for an unknown post", () => {
    expect(commentsFeedXml()).toContain("<title>Comments for Atlas Longevity</title>");
    expect(commentsFeedXml()).not.toContain("<item>");
    const post = publishedPosts()[0];
    expect(postCommentsFeedXml(post.slug)).toContain(`<title>Comments on: ${post.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>`);
    expect(postCommentsFeedXml("no-such-post")).toBeNull();
  });
});
