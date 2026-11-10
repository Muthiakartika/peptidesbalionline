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
    expect(archiveMetadata({ ...seo, robots: "noindex, nofollow" }, "/banner/").alternates).toBeUndefined();
    expect(archiveMetadata({ ...seo, robots: "index, follow" }, "/banner/").alternates).toEqual({ canonical: "/banner/" });
    expect(archiveMetadata(seo, "/banner/").alternates).toEqual({ canonical: "/banner/" });
  });
});
