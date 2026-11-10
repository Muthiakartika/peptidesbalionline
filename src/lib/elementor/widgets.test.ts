/**
 * The widget arithmetic against the values the live homepage's scripts produce (measured on
 * https://peptidesbali.online on 4 Nov 2026 in Chrome 152).
 */
import { describe, expect, it } from "vitest";

import home from "@/content/pages/home.json";

import { galleryAspectPercent, galleryContainerRatio, galleryLayouts, owlCloneCount, trustindexColumns, trustindexDotLeft } from "./widgets";

describe("Owl carousel copies", () => {
  it("adds 7 copies at each end of the 14 lab certificates (28 items in the stage, as live)", () => {
    // The carousel's own options from the homepage snapshot (4 per view on desktop since 5 Nov 2026;
    // it was 6 before, which gives the same count).
    const match = home.html.match(/data-owl-options='([^']*)'/);
    expect(match).not.toBeNull();
    const options = JSON.parse(match![1].replace(/&quot;/g, '"')) as { responsive: Record<string, { items: number }> };
    const maxInView = Math.max(...Object.values(options.responsive).map((b) => b.items));
    expect(owlCloneCount(14, maxInView, true)).toBe(7);
    expect(owlCloneCount(14, 6, true)).toBe(7);
  });
  it("needs at least two copies a side, and none without a loop", () => {
    expect(owlCloneCount(3, 1, true)).toBe(2);
    expect(owlCloneCount(14, 6, false)).toBe(0);
  });
});

describe("Trustindex reviews", () => {
  it("shows 3 / 2 / 1 columns at the widget widths of 1440 / 768 / 390px screens", () => {
    expect(trustindexColumns(1192, 300)).toBe(3);
    expect(trustindexColumns(786, 300)).toBe(2);
    expect(trustindexColumns(386, 300)).toBe(1);
  });
  it("moves the progress dot like the plugin (10 reviews)", () => {
    // 3 columns: 8 positions; 2 columns: 9; 1 column: 10.
    expect([1, 2, 6].map((i) => trustindexDotLeft(i, 8))).toEqual([13, 25, 75]);
    expect([1, 2].map((i) => trustindexDotLeft(i, 9))).toEqual([12, 23]);
    expect([1, 2].map((i) => trustindexDotLeft(i, 10))).toEqual([10, 20]);
  });
});

describe("Elementor gallery", () => {
  const settings = { columns: 3, columns_tablet: 2, columns_mobile: 2, gap: { size: 6 }, gap_tablet: { size: 10 }, gap_mobile: { size: 10 }, aspect_ratio: "1:1" };
  it("reads columns and gaps per screen size", () => {
    expect(galleryLayouts(settings)).toEqual({ desktop: { columns: 3, gap: 6 }, tablet: { columns: 2, gap: 10 }, mobile: { columns: 2, gap: 10 } });
    expect(galleryLayouts({ columns: 3, gap: { size: 6 } }).mobile).toEqual({ columns: 3, gap: 6 });
  });
  it("gives the live --aspect-ratio and --container-aspect-ratio (580px wide, 6 photos)", () => {
    expect(galleryAspectPercent("1:1")).toBe(100);
    expect(galleryAspectPercent("3:2")).toBe(66.6667);
    expect(`${galleryContainerRatio(580, 6, { columns: 3, gap: 6 }, 100)}%`).toBe("66.32000000000001%");
  });
  it("matches the homepage gallery's own settings", () => {
    const match = home.html.match(/elementor-widget-gallery"[^>]*data-settings='([^']*)'/) ?? home.html.match(/data-settings='([^']*)'[^>]*data-widget_type="gallery\.default"/);
    expect(match).not.toBeNull();
    const fromPage = JSON.parse(match![1]);
    expect(galleryLayouts(fromPage)).toEqual(galleryLayouts(settings));
  });
});
