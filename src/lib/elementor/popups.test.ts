/**
 * The homepage's popups (src/content/popups/, by scripts/audit/export_popups.py): the live settings
 * the rebuild follows, and no security token, reCAPTCHA key or IP address copied from the live form.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { elementorPopups } from "@/content/popups";

describe("homepage popups", () => {
  it("has the 5% offer (opens on scrolling down, at most 5 times) and its sign-up form", () => {
    const [offer, form] = elementorPopups;
    expect(offer.id).toBe(5869);
    expect(offer.settings).toMatchObject({ triggers: { scrolling: "yes", scrolling_direction: "down", scrolling_offset: 1 }, timing: { times: "yes", times_times: 5 }, prevent_scroll: "yes", prevent_close_on_esc_key: "yes" });
    expect(offer.html).toContain("Claim My 5%");
    // "Claim My 5%" opens popup 6534 (Elementor action link, settings in base64).
    expect(offer.html).toContain("popup%3Aopen%26settings%3D" + encodeURIComponent(btoa('{"id":"6534","toggle":false}')));
    expect(form.id).toBe(6534);
    expect(form.html).toContain('name="form_fields[name]"');
  });

  it("keeps no token, reCAPTCHA key or IP address, and has each popup's own CSS", () => {
    for (const popup of elementorPopups) {
      expect(popup.html).not.toMatch(/data-sitekey|(?<![\d.-])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/);
      expect(popup.html).not.toMatch(/name="[^"]*(nonce|referer)[^"]*"[^>]*value="[^"]+"/);
      expect(existsSync(path.join("public", "legacy", "elementor", `post-${popup.id}.css`)), String(popup.id)).toBe(true);
    }
  });
});
