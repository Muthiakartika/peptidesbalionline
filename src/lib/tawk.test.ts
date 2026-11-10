/**
 * Which Tawk.to chat the site loads: the live one by default, a test property from .env when both IDs
 * are set, and a build error for half-set or malformed IDs (they go into the page's script).
 */
import { describe, expect, it } from "vitest";

import { LIVE_TAWK, tawkEmbedUrl } from "./tawk";

describe("tawkEmbedUrl", () => {
  it("loads the live chat when no IDs are set (empty or spaces count as not set)", () => {
    const live = "https://embed.tawk.to/6ab794d5319803344d2cc1ac/1k3ehqojs";
    expect(`https://embed.tawk.to/${LIVE_TAWK.propertyId}/${LIVE_TAWK.widgetId}`).toBe(live);
    expect(tawkEmbedUrl({})).toBe(live);
    expect(tawkEmbedUrl({ TAWK_PROPERTY_ID: "", TAWK_WIDGET_ID: " " })).toBe(live);
  });

  it("loads another property when both IDs are set", () => {
    expect(tawkEmbedUrl({ TAWK_PROPERTY_ID: " 0123456789abcdef01234567 ", TAWK_WIDGET_ID: "default" })).toBe(
      "https://embed.tawk.to/0123456789abcdef01234567/default",
    );
  });

  it("stops the build when only one ID is set", () => {
    expect(() => tawkEmbedUrl({ TAWK_PROPERTY_ID: "0123456789abcdef01234567" })).toThrow(/set both/);
    expect(() => tawkEmbedUrl({ TAWK_WIDGET_ID: "default" })).toThrow(/set both/);
  });

  it("stops the build for values that are not IDs (they would go into a script)", () => {
    expect(() => tawkEmbedUrl({ TAWK_PROPERTY_ID: "https://embed.tawk.to/0123456789abcdef01234567/default", TAWK_WIDGET_ID: "default" })).toThrow(/TAWK_PROPERTY_ID/);
    expect(() => tawkEmbedUrl({ TAWK_PROPERTY_ID: "0123456789abcdef0123456", TAWK_WIDGET_ID: "default" })).toThrow(/TAWK_PROPERTY_ID/);
    expect(() => tawkEmbedUrl({ TAWK_PROPERTY_ID: "0123456789abcdef01234567", TAWK_WIDGET_ID: "x';alert(1);'" })).toThrow(/TAWK_WIDGET_ID/);
  });
});
