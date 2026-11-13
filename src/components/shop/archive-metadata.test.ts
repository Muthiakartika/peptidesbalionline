/**
 * Yoast's <head> tags as Next.js metadata: the robots line (the four values the live inventory has)
 * and no canonical link on noindex pages (/affiliate-area/, /banner/, /subscribe/ on live).
 */
import { describe, expect, it } from "vitest";

import { archiveMetadata, yoastRobots } from "./archive-metadata";

describe("Yoast metadata", () => {
  it("reads the robots lines the live site prints", () => {
    expect(yoastRobots("index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")).toEqual({
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    });
    expect(yoastRobots("noindex, follow")).toEqual({ index: false, follow: true });
    expect(yoastRobots("noindex, nofollow")).toEqual({ index: false, follow: false });
    expect(yoastRobots("index, nofollow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")).toMatchObject({ index: true, follow: false });
  });

  it("prints no canonical link on a noindex page, as Yoast", () => {
    const seo = { title: "Banner - Atlas Longevity", description: null, ogType: "article", ogTitle: null, ogDescription: null };
    expect(archiveMetadata({ ...seo, robots: "noindex, nofollow" }, "/banner/").alternates?.canonical).toBeUndefined();
    expect(archiveMetadata({ ...seo, robots: "index, follow" }, "/banner/").alternates?.canonical).toBe("/banner/");
    expect(archiveMetadata(seo, "/banner/").alternates?.canonical).toBe("/banner/");
  });

  it("lists WordPress's RSS feeds in the head, and a post's own comments feed", () => {
    const seo = { title: "BPC-157 vs TB-500", description: null, ogType: "article", ogTitle: null, ogDescription: null };
    expect(archiveMetadata(seo, "/bpc-157-bali/").alternates?.types).toEqual({
      "application/rss+xml": [
        { url: "/feed/", title: "Atlas Longevity » Feed" },
        { url: "/comments/feed/", title: "Atlas Longevity » Comments Feed" },
      ],
    });
    const post = archiveMetadata(seo, "/bpc-157-vs-tb-500/", null, { title: "BPC-157 vs TB-500 | Which Recovery Peptide Is Better?" });
    expect((post.alternates?.types as Record<string, unknown[]>)["application/rss+xml"][2]).toEqual({
      url: "/bpc-157-vs-tb-500/feed/",
      title: "Atlas Longevity » BPC-157 vs TB-500 | Which Recovery Peptide Is Better? Comments Feed",
    });
  });

  it("has live's link-preview picture and dates (copied 13 Nov 2026 from every sitemap address)", () => {
    const seo = { title: "BPC-157 vs TB-500", description: null, ogType: "article", ogTitle: null, ogDescription: null };
    const og = archiveMetadata(seo, "/bpc-157-vs-tb-500/").openGraph as Record<string, unknown>;
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-05-16T15:20:20+00:00");
    expect(og.modifiedTime).toBe("2026-08-17T17:48:37+00:00");
    expect(og.images).toEqual([
      { url: expect.stringMatching(/\/wp-content\/uploads\/2026\/05\/bpc-157-vs-tb-500-bali-recovery-comparison\.jpg\.png$/), width: 1536, height: 1024, type: "image/png" },
    ]);
  });

  it("uses a new product's own picture when live has none for its address", () => {
    const seo = { title: "New", description: null, ogType: "article", ogTitle: null, ogDescription: null };
    const og = archiveMetadata(seo, "/product/made-in-the-admin/", { src: "https://media.example.com/new.webp", width: 600, height: 600 }).openGraph as Record<string, unknown>;
    expect(og.images).toEqual([{ url: "https://media.example.com/new.webp", width: 600, height: 600 }]);
    expect(og.publishedTime).toBeUndefined();
    expect((archiveMetadata(seo, "/product/made-in-the-admin/").openGraph as Record<string, unknown>).images).toBeUndefined();
  });
});
