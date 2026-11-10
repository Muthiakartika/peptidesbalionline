/**
 * The Elementor page snapshot (src/content/pages/, made by scripts/audit/export_elementor_pages.py):
 * every address of docs/audit/page-inventory.md has its page, and every page has its CSS.
 * Four 3g pages (the affiliate area, login, registration and terms) are plain WordPress pages: no
 * Elementor document, so no Elementor CSS of their own.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { elementorPageNames } from "@/content/pages";

import { getElementorPage, landingPageNames } from "./pages";

const entries = Object.entries(elementorPageNames);

describe("Elementor pages", () => {
  it("has the homepage, the 52 landing pages, /insights/ and the 20 information pages, by family", async () => {
    expect(elementorPageNames["/"]).toBe("home");
    expect(landingPageNames).toHaveLength(74);
    const families: Record<string, number> = {};
    for (const [, name] of entries) {
      const page = await getElementorPage(name);
      families[page!.family] = (families[page!.family] ?? 0) + 1;
    }
    expect(families).toEqual({ home: 1, compound: 16, price: 6, goal: 10, "bali-area": 10, city: 10, blog: 1, info: 9, legal: 6, affiliate: 5, tools: 1 });
  });

  it("stores each page under its own address, with its Elementor document (or a plain page's text)", async () => {
    const plain: string[] = [];
    for (const [address, name] of entries) {
      const page = await getElementorPage(name);
      expect(page?.path).toBe(address);
      if (page!.plain) {
        plain.push(address);
        expect(page!.html).not.toContain("data-elementor-id");
        expect(page!.articleClass).toContain(`post-${page!.docId}`);
      } else {
        expect(page!.html).toContain(`data-elementor-id="${page!.docId}"`);
      }
      expect(page!.seo.title).toBeTruthy();
    }
    expect(plain.sort()).toEqual(["/affiliate-area/", "/affiliate-login/", "/affiliate-registration/", "/affiliate-terms-of-use/", "/calculator/"]);
  });

  it("keeps no security token, reCAPTCHA key or IP address from the live forms", async () => {
    for (const [, name] of entries) {
      const page = await getElementorPage(name);
      // An IP address: four numbers joined by dots (not part of an SVG path's numbers).
      expect(page!.html, name).not.toMatch(/data-sitekey|(?<![\d.-])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/);
      expect(page!.html, name).not.toMatch(/name="[^"]*nonce[^"]*"[^>]*value="[^"]+"/);
    }
  });

  it("has every other page's own Elementor CSS in public/legacy/elementor/", async () => {
    for (const name of landingPageNames) {
      const page = await getElementorPage(name);
      if (page!.plain) continue;
      expect(page!.stylesheets).toContain(page!.docId);
      expect(existsSync(path.join("public", "legacy", "elementor", `post-${page!.docId}.css`)), name).toBe(true);
    }
  });

  it("knows no other page", async () => {
    expect(await getElementorPage("no-such-page")).toBeNull();
    expect(landingPageNames).not.toContain("home");
  });
});
