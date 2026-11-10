/** The shop's archive arguments in the address (src/proxy.ts → the category and shop page routes). */
import { describe, expect, it } from "vitest";

import { archiveHref, paramsFromView, pickArchiveParams, viewSegment } from "./shop-url";

describe("archive arguments in the address", () => {
  it("keeps only the archive arguments, in one order, so each view is one page", () => {
    expect(viewSegment(pickArchiveParams({ per_page: "9", utm_source: "x", orderby: "price" }))).toBe("orderby=price&per_page=9");
    expect(viewSegment(pickArchiveParams({ utm_source: "x" }))).toBeNull();
  });

  it("gives the same arguments back (as Next.js decodes the segment), and the same links", () => {
    const params = pickArchiveParams({ orderby: "price", per_page: "9", shop_view: "list" });
    const segment = decodeURIComponent(encodeURIComponent(viewSegment(params)!));
    expect(paramsFromView(segment)).toEqual(params);
    // A catch-all route gets the segment still encoded.
    expect(paramsFromView(encodeURIComponent(viewSegment(params)!))).toEqual(params);
    expect(paramsFromView(undefined)).toEqual({});
    expect(archiveHref("/product-category/vial/", 2, paramsFromView(segment))).toBe("/product-category/vial/page/2/?orderby=price&per_page=9&shop_view=list");
  });
});
