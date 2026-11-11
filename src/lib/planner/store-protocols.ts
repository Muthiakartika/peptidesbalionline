/**
 * GET /store-protocols and GET /store-protocols/{id} of the planner API: the "Pre-built protocols"
 * the store wrote (plugin 1.7), from the snapshot. Filtering as on live (checked 11 Nov 2026,
 * ./fixtures/store-protocols/):
 *
 *   product  only protocols with an item of this product (0 = all);
 *   search   case-insensitive text in the name, the group, the description or a product's name;
 *   group    one group's protocols (an unknown key gives none);
 *   offset, limit (1–50, default 12).
 *
 * `all_count` and `groups` count what the product and search filters leave (before the group filter,
 * so the group chips keep their numbers); `product_counts` always counts every protocol.
 * Creating and editing them (the store's managers, in the builder) is not offered on this site.
 */
import "server-only";

import { plannerStoreProtocols, type StoreProtocolCard } from "./data";
import type { ArgSchema } from "./rest";

export const STORE_PROTOCOL_ARGS = {
  group: { type: "string", default: "", maxLength: 60, pattern: "^([a-z0-9-]{1,60})?(?![\\s\\S])" },
  product: { type: "integer", default: 0, minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  search: { type: "string", default: "", maxLength: 100 },
  offset: { type: "integer", default: 0, minimum: 0, maximum: 299 },
  limit: { type: "integer", default: 12, minimum: 1, maximum: 50 },
} satisfies Record<string, ArgSchema>;

/** Store protocol ids (the route's own pattern: other ids are "no route" on WordPress). */
export const STORE_PROTOCOL_ID = /^[a-z0-9-]{1,40}$/;

/** The product ids of a protocol's items. */
function productIds(card: StoreProtocolCard): number[] {
  const detail = plannerStoreProtocols.details[card.id] as { plan?: { lines?: { product_id: number }[] } } | undefined;
  const lines = detail?.plan?.lines ?? [];
  return lines.length ? lines.map((line) => line.product_id) : card.products.map((product) => product.product_id);
}

function matchesSearch(card: StoreProtocolCard, search: string): boolean {
  const needle = search.toLowerCase();
  const texts = [card.name, card.group?.label ?? "", card.description ?? "", ...card.products.map((product) => product.name)];
  return texts.some((text) => text.toLowerCase().includes(needle));
}

export function queryStoreProtocols(query: { group: string; product: number; search: string; offset: number; limit: number }) {
  let cards = plannerStoreProtocols.items;
  if (query.product > 0) cards = cards.filter((card) => productIds(card).includes(query.product));
  const search = query.search.trim();
  if (search) cards = cards.filter((card) => matchesSearch(card, search));
  const groups: { key: string; label: string; count: number }[] = [];
  for (const card of cards) {
    const group = groups.find((g) => g.key === card.group.key);
    if (group) group.count++;
    else groups.push({ key: card.group.key, label: card.group.label, count: 1 });
  }
  const allCount = cards.length;
  if (query.group) cards = cards.filter((card) => card.group.key === query.group);
  return {
    items: cards.slice(query.offset, query.offset + query.limit),
    total: cards.length,
    offset: query.offset,
    limit: query.limit,
    all_count: allCount,
    groups,
    product_counts: plannerStoreProtocols.product_counts,
    version: plannerStoreProtocols.version,
  };
}

/** One protocol's detail, or null. */
export function storeProtocolDetail(id: string) {
  return Object.hasOwn(plannerStoreProtocols.details, id) ? plannerStoreProtocols.details[id] : null;
}
