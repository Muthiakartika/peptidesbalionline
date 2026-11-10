/**
 * The structured-data snapshot (src/content/seo/jsonld.json, scripts/audit/export_jsonld.py): every
 * page of the live inventory has its blocks, they are valid JSON-LD, and no personal data is left
 * (the blog author's public name is an e-mail address on the live site, R-12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import data from "@/content/seo/jsonld.json";

type Block = { yoast: boolean; data: Record<string, unknown> };
const snapshot = data as Record<string, Block[]>;
const inventory = JSON.parse(readFileSync(path.join("docs", "audit", "data", "page-inventory.json"), "utf8")) as {
  pages: { url: string; status: number; redirected?: boolean }[];
};

describe("structured data", () => {
  it("has the blocks of every page the live inventory lists (Yoast's graph first)", () => {
    const pages = inventory.pages.filter((page) => page.status === 200 && !page.redirected).map((page) => new URL(page.url));
    for (const url of pages) {
      const blocks = snapshot[url.pathname + url.search];
      expect(blocks, url.pathname + url.search).toBeDefined();
    }
    for (const [address, blocks] of Object.entries(snapshot)) {
      // Yoast writes "https://schema.org", the owner's Product blocks "https://schema.org/".
      for (const block of blocks) expect(block.data["@context"], address).toMatch(/^https:\/\/schema\.org\/?$/);
    }
    expect(snapshot["/product/bpc-157/"].map((block) => block.yoast)).toContain(true);
  });

  it("keeps no e-mail address other than the shop's public one, and no Gravatar picture", () => {
    const text = JSON.stringify(snapshot).replaceAll("hello@peptidesbali.online", "");
    expect(text).not.toMatch(/[\w.+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)+/);
    expect(text).not.toMatch(/gravatar\.com\/avatar\/[0-9a-f]{20,}/);
  });

  it("names the blog posts' author as the rebuild shows it", () => {
    const graph = snapshot["/what-is-bpc-157/"].find((block) => block.yoast)!.data["@graph"] as Record<string, unknown>[];
    const person = graph.find((node) => node["@type"] === "Person" || (Array.isArray(node["@type"]) && node["@type"].includes("Person")));
    expect(person?.name).toBe("Atlas Longevity");
    expect(Object.keys(person ?? {}).sort()).toEqual(["@id", "@type", "name"]);
  });
});
