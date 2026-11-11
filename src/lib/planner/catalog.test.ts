/**
 * GET /catalog, /catalog/categories and /store-protocols against the live plugin: 23 queries sent to
 * https://peptidesbali.online on 11 Nov 2026 (./fixtures/catalog/, ./fixtures/store-protocols/).
 * The catalogue queries run on the list of that day (./fixtures/catalog/catalog.json, frozen: the
 * name, categories and formats of each product in live's order) and must give the same products in
 * the same order, the same counts and format tabs, and WordPress's own errors for bad arguments.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import catalogFile from "@/content/planner/catalog.json";
import categoriesFile from "@/content/planner/categories.json";

import { CATALOG_ARGS, categoriesResponse, queryCatalog } from "./catalog";
import type { CatalogItem } from "./data";
import { readArgs } from "./rest";
import { queryStoreProtocols, STORE_PROTOCOL_ARGS } from "./store-protocols";

type Fixture = { name: string; route: string; status: number; response: Record<string, unknown> & { items?: { id: number | string }[] } };

function fixtures(folder: string): Fixture[] {
  const dir = path.join(__dirname, "fixtures", folder);
  return readdirSync(dir)
    .filter((name) => /^[a-z]\d+\.json$/.test(name))
    .sort()
    .map((name) => ({ name, ...(JSON.parse(readFileSync(path.join(dir, name), "utf8")) as Omit<Fixture, "name">) }));
}

const frozen = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "catalog", "catalog.json"), "utf8")) as CatalogItem[];

/** The answer's body (JSON) for a query string, as the API route gives it. */
async function answer(route: string, run: (args: never) => unknown, schemas: Parameters<typeof readArgs>[1]) {
  const query = new URL(`http://x/${route}`).searchParams;
  const args = readArgs(query, schemas);
  if (!args.ok) return { status: args.response.status, body: await args.response.json() };
  return { status: 200, body: run(args.args as never) as Record<string, unknown> };
}

describe("GET /catalog", () => {
  for (const fixture of fixtures("catalog")) {
    it(`answers ${fixture.route} as live`, async () => {
      const { status, body } = await answer(fixture.route, (args) => queryCatalog(frozen, args), CATALOG_ARGS);
      expect(status).toBe(fixture.status);
      if (fixture.status !== 200) {
        expect(body).toEqual(fixture.response);
        return;
      }
      const page = body as ReturnType<typeof queryCatalog>;
      expect(page.items.map((item) => item.id)).toEqual(fixture.response.items?.map((item) => item.id));
      expect({ total: page.total, pages: page.pages, page: page.page, formats: page.formats }).toEqual({
        total: fixture.response.total,
        pages: fixture.response.pages,
        page: fixture.response.page,
        formats: fixture.response.formats,
      });
    });
  }

  it("keeps the snapshot's products in live's order, every page of them", () => {
    const items = (catalogFile as unknown as { items: CatalogItem[] }).items;
    expect(items.map((item) => item.id)).toEqual(frozen.map((item) => item.id));
    expect(queryCatalog(items, { search: "", category: "", format: "", group: "", page: 1, per_page: 24 }).pages).toBe(Math.ceil(items.length / 24));
  });

  it("counts the categories and chips as live does", () => {
    const counted = categoriesResponse((catalogFile as unknown as { items: CatalogItem[] }).items);
    expect(counted).toEqual(categoriesFile);
  });
});

describe("GET /store-protocols", () => {
  for (const fixture of fixtures("store-protocols").filter((f) => !f.route.includes("/"))) {
    it(`answers ${fixture.route} as live`, async () => {
      const { status, body } = await answer(fixture.route, (args) => queryStoreProtocols(args), STORE_PROTOCOL_ARGS);
      expect(status).toBe(fixture.status);
      if (fixture.status !== 200) {
        expect(body).toEqual(fixture.response);
        return;
      }
      const ids = (list: unknown) => (list as { id: string }[]).map((item) => item.id);
      expect({ ...body, items: ids(body.items) }).toEqual({ ...fixture.response, items: ids(fixture.response.items) });
    });
  }
});
