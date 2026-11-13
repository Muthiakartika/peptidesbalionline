/**
 * The delivery map's fixed parts: the Maps script address and how a coordinate is kept. (The map itself needs Google
 * and a key: checked by hand, docs/setup/google-maps.md.)
 */
import { describe, expect, it } from "vitest";

import { BALI_CENTER, coordinate, mapsScriptUrl } from "./DeliveryMap";

describe("the delivery map", () => {
  it("loads the Maps JavaScript API with Places, in English, biased to Indonesia", () => {
    const url = new URL(mapsScriptUrl("test key&x=1"));
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/js");
    expect(url.searchParams.get("key")).toBe("test key&x=1");
    expect(url.searchParams.get("libraries")).toBe("places");
    expect(url.searchParams.get("region")).toBe("ID");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("loading")).toBe("async");
    expect(url.searchParams.get("callback")).toBeTruthy();
  });

  it("keeps coordinates with 7 decimals and opens on Bali", () => {
    expect(coordinate(-8.40951234567)).toBe("-8.4095123");
    expect(coordinate(115.1889)).toBe("115.1889000");
    expect(BALI_CENTER.lat).toBeLessThan(-8);
    expect(BALI_CENTER.lng).toBeGreaterThan(114.4);
    expect(BALI_CENTER.lng).toBeLessThan(115.8);
  });
});
