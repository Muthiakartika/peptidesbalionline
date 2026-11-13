/**
 * A product whose slug was changed in /admin/products/: its old address answers 301 to the new one (as
 * WordPress's old-slug redirect), unless a product uses that address now; an unknown address stays a 404.
 */
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog/archive-index", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/catalog/archive-index")>();
  const products = [
    { slug: "bpc-157-10mg", oldSlugs: ["bpc-157-old", "BPC-Older", "bpc-157"] },
    { slug: "tb-500", oldSlugs: [] },
  ];
  const paths = new Set(["/product/bpc-157-10mg/", "/product/tb-500/", "/product/bpc-157/"]);
  const index = { ...original.snapshotIndex, productPaths: paths, movedProducts: original.movedProductsOf(products, paths) };
  return { ...original, currentShopIndex: async () => index };
});

const { proxy } = await import("./proxy");
const { movedProductsOf } = await import("@/lib/catalog/archive-index");
const run = (address: string) => proxy(new NextRequest(new URL(address, "http://localhost:3000"), { nextConfig: { trailingSlash: true } }));

describe("a product's old address", () => {
  it("answers 301 to the product's address now, without the query", async () => {
    const response = await run("/product/bpc-157-old/?utm_source=x");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("http://localhost:3000/product/bpc-157-10mg/");
    expect((await run("/product/bpc-older/")).headers.get("location")).toBe("http://localhost:3000/product/bpc-157-10mg/");
  });

  it("leaves an address a product uses now to that product, and unknown ones to the 404", async () => {
    expect((await run("/product/bpc-157/")).status).toBe(200);
    expect((await run("/product/no-such-product/")).headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/product/");
  });

  it("only maps the old addresses of products that are in the shop", () => {
    const moved = movedProductsOf([{ slug: "gone", oldSlugs: ["older"] }, { slug: "here", oldSlugs: ["before"] }], new Set(["/product/here/"]));
    expect([...moved]).toEqual([["/product/before/", "/product/here/"]]);
  });
});
