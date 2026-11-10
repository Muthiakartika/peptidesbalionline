/** GET /api/products/: the cards the homepage's "recently viewed" grid asks for. */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { getAllProducts, getCategories, isInCategories } from "@/lib/catalog";

import { GET } from "./route";

const get = async (query: string) => (await (await GET(new NextRequest(`http://localhost/api/products/?${query}`))).json()) as { id: number }[];
const all = await getAllProducts();

describe("GET /api/products/", () => {
  const [a, b] = all;

  it("returns the products in the order asked for, skipping unknown ids", async () => {
    expect((await get(`ids=${b.id},999999,${a.id}`)).map((p) => p.id)).toEqual([b.id, a.id]);
  });
  it("ignores anything that isn't an id", async () => {
    expect(await get("ids=abc,-1,1.5")).toEqual([]);
    expect(await get("")).toEqual([]);
  });
  it("keeps only products of the category (sub-categories included)", async () => {
    const peptideVials = 18;
    const ids = all.map((p) => p.id);
    const categories = await getCategories();
    const expected = all.filter((p) => isInCategories(p, [peptideVials], categories)).map((p) => p.id);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(ids.length);
    const result = (await get(`ids=${ids.slice(0, 50).join(",")}&category=${peptideVials}`)).map((p) => p.id);
    expect(result).toEqual(expected.filter((id) => ids.slice(0, 50).includes(id)));
  });
});
