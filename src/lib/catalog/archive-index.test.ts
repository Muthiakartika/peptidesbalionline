/**
 * The proxy's view of the shop (archive-index.ts) must agree with what the pages show (getListing),
 * or the proxy would send an existing page to the 404 page, or let a missing one through.
 */
import { describe, expect, it } from "vitest";

import { categoryProductCounts, lastPage, normalisePerPage, productPaths, shopProductCount } from "./archive-index";
import { getAllProducts, getCategories, getListing } from "./index";

describe("archive index", () => {
  it("knows every product address and nothing else", async () => {
    expect([...productPaths].sort()).toEqual((await getAllProducts()).map((p) => p.path).sort());
  });

  it("counts the same products per listing as the shop and category pages", async () => {
    expect(shopProductCount).toBe((await getListing({})).total);
    const categories = await getCategories();
    expect(categoryProductCounts.size).toBe(categories.length);
    for (const category of categories) {
      expect(categoryProductCounts.get(category.slug), category.path).toBe((await getListing({ category })).total);
      for (const perPage of [9, 21, 100]) {
        expect(lastPage(categoryProductCounts.get(category.slug)!, perPage)).toBe((await getListing({ category, perPage })).totalPages);
      }
    }
  });

  it("reads ?per_page= as the live site does", () => {
    expect(normalisePerPage(null)).toBe(21);
    expect(normalisePerPage("9")).toBe(9);
    expect(normalisePerPage("0")).toBe(21);
    expect(normalisePerPage("abc")).toBe(21);
    expect(normalisePerPage("100")).toBe(100);
  });
});
