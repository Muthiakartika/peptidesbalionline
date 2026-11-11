/**
 * GET /catalog of the planner API: the products the Protocol Builder offers, filtered and paged as
 * the live plugin does it (checked with 16 queries on 11 Nov 2026, src/lib/planner/fixtures/catalog/):
 *
 *   search    every word must be in the product title, "-word" must not (WordPress's title search:
 *             src/lib/catalog/search.ts, without the shop's compound-name aliases: live's planner
 *             finds nothing for "retatrutide");
 *   category  a category id or slug, its sub-categories included;
 *   group     a category "chip" of the Vials tab (GET /catalog/categories `groups`); unknown -> nothing;
 *   format    vial, pen, nasal_spray, …;
 *   page, per_page (1–48, default 24).
 *
 * The order is always live's own (the snapshot keeps it). `formats` lists the formats of the products
 * the search and category leave (before the format and group filters), so the format tabs stay.
 */
import "server-only";

import { matchesTitleSearch, parseSearchTerms } from "@/lib/catalog/search";

import { plannerCategories, timestamp, type CatalogItem } from "./data";
import type { ArgSchema } from "./rest";

/** The container formats, in the order the plugin lists them. */
export const FORMATS = ["vial", "pen", "nasal_spray", "bundle", "supply", "other"];

/** GET /catalog's arguments (the plugin's REST schema, rest-index of the live site). */
export const CATALOG_ARGS = {
  search: { type: "string", default: "", maxLength: 100 },
  category: { type: "string", default: "", maxLength: 200, pattern: "^[A-Za-z0-9%_-]*$" },
  format: { type: "string", default: "", enum: ["", ...FORMATS] },
  group: { type: "string", default: "", maxLength: 60, pattern: "^([a-z0-9-]{1,60})?(?![\\s\\S])" },
  page: { type: "integer", default: 1, minimum: 1, maximum: 1000 },
  per_page: { type: "integer", default: 24, minimum: 1, maximum: 48 },
} satisfies Record<string, ArgSchema>;

export type CatalogQuery = { search: string; category: string; format: string; group: string; page: number; per_page: number };

/** Category id -> its parent's id (0 at the top), from GET /catalog/categories. */
const parents = new Map(plannerCategories.items.map((category) => [category.id, category.parent]));

/** Whether a category is `ancestor` itself or one of its sub-categories. */
function isWithin(categoryId: number, ancestors: Set<number>): boolean {
  for (let id = categoryId, depth = 0; id > 0 && depth < 20; id = parents.get(id) ?? 0, depth++) {
    if (ancestors.has(id)) return true;
  }
  return false;
}

const inCategories = (item: CatalogItem, ids: Set<number>) => item.categories.some((category) => isWithin(category.id, ids));

/** A category id or slug -> its id; null when there is no such category. */
function categoryId(value: string): number | null {
  const found = /^\d+$/.test(value)
    ? plannerCategories.items.find((category) => category.id === Number(value))
    : plannerCategories.items.find((category) => category.slug === value.toLowerCase());
  return found ? found.id : null;
}

/**
 * GET /catalog/categories: the categories and the Vials tab's chip groups, each with how many of
 * the planner's products it holds now (sub-categories included).
 */
export function categoriesResponse(items: CatalogItem[]) {
  const count = (ids: number[]) => items.filter((item) => inCategories(item, new Set(ids))).length;
  // A category or chip whose products are all gone from the shop is left out (live lists none empty).
  return {
    items: plannerCategories.items.map((category) => ({ ...category, count: count([category.id]) })).filter((category) => category.count > 0),
    groups: plannerCategories.groups.map((group) => ({ ...group, count: count(group.term_ids) })).filter((group) => group.count > 0),
  };
}

export function queryCatalog(items: CatalogItem[], query: CatalogQuery) {
  let matches = items;
  const search = query.search.trim();
  if (search) {
    const terms = parseSearchTerms(search, { aliases: false });
    matches = matches.filter((item) => matchesTitleSearch(item.name, terms));
  }
  if (query.category) {
    const id = categoryId(query.category);
    matches = id === null ? [] : matches.filter((item) => inCategories(item, new Set([id])));
  }
  // The format tabs: what the search and category leave, in the plugin's order.
  const present = new Set(matches.flatMap((item) => item.formats));
  const formats = FORMATS.filter((format) => present.has(format));
  if (query.group) {
    const group = plannerCategories.groups.find((g) => g.key === query.group);
    matches = group ? matches.filter((item) => inCategories(item, new Set(group.term_ids))) : [];
  }
  if (query.format) matches = matches.filter((item) => item.formats.includes(query.format));

  const total = matches.length;
  const now = timestamp();
  const start = (query.page - 1) * query.per_page;
  return {
    items: matches.slice(start, start + query.per_page).map((item) => ({ ...item, fetched_at: now })),
    total,
    pages: Math.ceil(total / query.per_page),
    page: query.page,
    formats,
  };
}
