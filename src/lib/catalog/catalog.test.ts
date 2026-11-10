/**
 * Checks the catalogue rules against what the live site actually does. The expected values were
 * recorded from https://peptidesbali.online on 4 Nov 2026 (search-samples.json,
 * ajax-search-samples.json) or come from the snapshot itself (catalog.json).
 */
import { describe, expect, it } from "vitest";

import rawSnapshot from "@/content/catalog.json";

import { formatUsd, getCategories, getListing, getSearchSuggestions } from "./index";
import ajaxSamples from "./ajax-search-samples.json";
import { parseSearchTerms } from "./search";
import searchSamples from "./search-samples.json";

describe("USD hint", () => {
  it("reproduces the live text for every product", () => {
    for (const p of rawSnapshot.products) {
      expect(formatUsd(BigInt(p.priceMin), BigInt(p.priceMax)), p.name).toBe(p.usdText);
    }
  });
  it("rounds to the nearest cent", () => {
    expect(formatUsd(408_000_000n)).toBe("~$247.27");
    expect(formatUsd(250_000_000n, 850_000_000n)).toBe("~$151.52–$515.15");
  });
});

describe("shop and category listings", () => {
  it("pages the shop like the live site (21 per page, 9 pages)", async () => {
    const first = await getListing({});
    expect(first.total).toBe(rawSnapshot.products.length);
    expect(first.totalPages).toBe(Math.ceil(first.total / 21));
    expect([first.first, first.last]).toEqual([1, 21]);
    const last = await getListing({ page: first.totalPages });
    expect(last.last).toBe(first.total);
  });
  it("counts the same products per category as WooCommerce", async () => {
    for (const category of await getCategories()) {
      expect((await getListing({ category })).total, category.path).toBe(category.count);
    }
  });
  it("sorts by the live site's order for each option", async () => {
    for (const orderby of ["menu_order", "date", "price", "price-desc", "title"] as const) {
      const ids = (await getListing({ orderby, perPage: 500 })).products.map((p) => p.id);
      const expected = [...rawSnapshot.products].sort((a, b) => a.ranks[orderby] - b.ranks[orderby]).map((p) => p.id);
      expect(ids).toEqual(expected);
    }
  });
});

describe("search results page", () => {
  for (const sample of searchSamples.samples) {
    it(`"${sample.query}" finds the same products in the same order`, async () => {
      const ids = (await getListing({ search: sample.query, perPage: 500 })).products.map((p) => p.id);
      if (sample.ids.length === 0 && sample.h1 && !sample.h1.startsWith("Search results")) {
        // The live site redirected straight to the only matching product.
        expect(ids).toHaveLength(1);
      } else {
        expect(ids).toEqual(sample.ids);
      }
    });
  }
});

describe("search suggestions", () => {
  for (const sample of ajaxSamples.samples) {
    it(`"${sample.query}" suggests the same categories and products`, async () => {
      const result = await getSearchSuggestions(sample.query);
      const liveProducts = sample.suggestions.filter((s) => s.group === "product" && s.id).map((s) => s.id);
      const liveCategories = sample.suggestions.filter((s) => s.group === "categories" && s.value).map((s) => s.path);
      expect(result.products.map((p) => p.id)).toEqual(liveProducts);
      expect(result.categories.map((c) => c.path)).toEqual(liveCategories);
    });
  }
});

describe("search matches the stored title, like the live database search", () => {
  // Recorded on the live site on 4 Nov 2026 (one match = redirect to that product).
  const count = async (query: string) => (await getListing({ search: query, perPage: 500 })).total;
  it("uses straight apostrophes and hyphens", async () => {
    expect(await count("women's")).toBe(1);
    expect(await count("women’s")).toBe(0);
    expect(await count("blend - tb")).toBe(5);
    expect(await count("blend – tb")).toBe(0);
  });
  it("keeps & in titles", async () => {
    expect(await count("ghk-cu & tesamorelin")).toBe(1);
  });
});

describe("search terms", () => {
  it("splits words and phrases like WordPress", () => {
    expect(parseSearchTerms('bpc -pen "tb 500"')).toEqual([
      { text: "bpc", exclude: false },
      { text: "pen", exclude: true },
      { text: "tb 500", exclude: false },
    ]);
    expect(parseSearchTerms("the a")).toEqual([{ text: "the a", exclude: false }]);
    expect(parseSearchTerms("Retatrutide")).toEqual([{ text: "glp-3 rta", exclude: false }]);
  });
});
