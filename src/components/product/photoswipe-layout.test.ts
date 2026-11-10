/**
 * The "Click to enlarge" viewer must place pictures where PhotoSwipe does on the live site.
 * Expected boxes were measured on https://peptidesbali.online/product/bpc157-5mg-pen/ (4 Nov 2026).
 */
import { describe, expect, it } from "vitest";

import { clamp, placement } from "./photoswipe-layout";

const round = (box: { x: number; y: number; width: number; height: number }) => Object.values(box).map((n) => Math.round(n));

describe("PhotoSwipe picture placement", () => {
  const desktop = { width: 1440, height: 900, bar: 44 };

  it("fits a square picture between the 44px bars (desktop 1440 × 900)", () => {
    expect(round(placement({ width: 1254, height: 1254 }, desktop, false, { x: 0, y: 0 }))).toEqual([314, 44, 812, 812]);
  });

  it("fits a tall picture by its height", () => {
    expect(round(placement({ width: 1024, height: 1536 }, desktop, false, { x: 0, y: 0 }))).toEqual([449, 44, 541, 812]);
  });

  it("zooms to full size, centred", () => {
    const fit = placement({ width: 1254, height: 1254 }, desktop, false, { x: 0, y: 0 });
    // The zoom button zooms on the centre of the screen; the full-size picture is then centred.
    const centre = { x: 720 - (720 - fit.x) * (1254 / fit.width), y: 450 - (450 - fit.y) * (1254 / fit.height) };
    expect(round(placement({ width: 1254, height: 1254 }, desktop, true, centre))).toEqual([93, -177, 1254, 1254]);
  });

  it("uses the whole height on a small touch screen (no bars)", () => {
    expect(round(placement({ width: 1254, height: 1254 }, { width: 390, height: 900, bar: 0 }, false, { x: 0, y: 0 }))).toEqual([0, 255, 390, 390]);
  });

  it("never enlarges a small picture", () => {
    expect(round(placement({ width: 300, height: 200 }, desktop, false, { x: 0, y: 0 }))).toEqual([570, 350, 300, 200]);
  });

  it("keeps a dragged, zoomed picture covering the screen", () => {
    expect(clamp(50, 1440, 2000)).toBe(0); // dragged too far right
    expect(clamp(-900, 1440, 2000)).toBe(-560); // dragged too far left
    expect(clamp(-300, 1440, 2000)).toBe(-300);
    expect(clamp(-300, 1440, 1000)).toBe(220); // smaller than the screen: centred
  });
});
