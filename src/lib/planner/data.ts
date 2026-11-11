/**
 * The Protocol Builder's data: the snapshot of the live planner (src/content/planner/, made by
 * `node scripts/planner/export-planner-data.mjs`) with today's prices and stock from this shop's own
 * catalogue laid over it.
 *
 * From the snapshot: which products the planner offers, their options and the store-verified
 * capacity of each option ("mapping": 5 mg per vial, 10 IU per vial, …), which the calculation needs
 * and the shop's own catalogue doesn't have. From the shop's catalogue (src/lib/catalog, the same
 * data the cart charges, see priceCart in src/lib/commerce/cart-lines.ts): the price, whether it is
 * in stock or on backorder, and whether the product or option still exists. So the planner's
 * estimate is exactly what the cart then charges.
 */
import "server-only";

import catalogFile from "@/content/planner/catalog.json";
import categoriesFile from "@/content/planner/categories.json";
import combinationsFile from "@/content/planner/combinations.json";
import productsFile from "@/content/planner/products.json";
import settingsFile from "@/content/planner/settings.json";
import storeProtocolsFile from "@/content/planner/store-protocols.json";
import { getCatalogState, type CatalogState, type Product } from "@/lib/catalog";
import { withMediaUrls } from "@/lib/media/url";

// ---------------------------------------------------------------------------------------------
// The snapshot's shapes (as live's GET /product/{id} and GET /catalog print them).
// ---------------------------------------------------------------------------------------------

export type Capacity = { dimension: string; amount: string; unit: string; basis: string };

/** One thing that can be bought: a simple product (variation_id 0) or one variation. */
export type PlannerUnit = {
  product_id: number;
  variation_id: number;
  type: string;
  name: string;
  parent_name: string;
  attributes: Record<string, string>;
  attribute_labels: Record<string, string>;
  attribute_details?: unknown[];
  permalink: string;
  image: unknown;
  price: string;
  regular_price: string;
  on_sale: boolean;
  stock_status: string;
  backorders_allowed: boolean;
  stock_quantity: number | null;
  is_purchasable: boolean;
  sold_individually: boolean;
  min_qty: number;
  max_qty: number;
  /** "ready" (can be planned), "needs_mapping" (no verified capacity yet), … */
  readiness: string;
  readiness_message: string;
  plannable: boolean;
  modes: string[];
  container_type: string;
  pack_count: number | null;
  capacities: Capacity[];
  compatible_units: string[];
  mapping: { component_composition?: { product_id: number; variation_id?: number; quantity: number }[] } & Record<string, unknown> | null;
  fetched_at?: string;
};

export type PlannerProduct = {
  id: number;
  name: string;
  type: string;
  permalink: string;
  image: unknown;
  categories: { id: number; slug: string; name: string }[];
  attributes: unknown[];
  default_attributes: Record<string, string>;
  units: PlannerUnit[];
  fetched_at?: string;
};

export type CatalogItem = {
  id: number;
  name: string;
  type: string;
  permalink: string;
  image: unknown;
  categories: { id: number; slug: string; name: string }[];
  formats: string[];
  price_min: string;
  price_max: string;
  sizes: string[];
  cheapest_capacity: Capacity | null;
  cheapest_pack_count: number;
  ready_units: number;
  in_stock_units: number;
  display_group: string;
  display_order: number;
};

export type PlannerCategory = { id: number; slug: string; name: string; parent: number; count: number };
export type PlannerGroup = { key: string; label: string; term_ids: number[]; count: number };

export type StoreProtocolCard = {
  id: string;
  name: string;
  group: { key: string; label: string };
  description: string;
  products: { product_id: number; name: string }[];
} & Record<string, unknown>;

type StoreProtocolsFile = {
  all_count: number;
  groups: { key: string; label: string; count: number }[];
  product_counts: [number, number][];
  version: string;
  items: StoreProtocolCard[];
  details: Record<string, Record<string, unknown>>;
};

/** Readiness values that can be planned (catalog.js PLANNABLE). */
export const PLANNABLE = ["ready", "manual_addon"];

// The snapshot, with its pictures on this site's media address (as the rest of the site's copies).
const snapshotProducts = withMediaUrls(productsFile as unknown as Record<string, PlannerProduct>);
const snapshotCatalog = withMediaUrls((catalogFile as unknown as { formats: string[]; items: CatalogItem[] }).items);
export const plannerCategories = categoriesFile as unknown as { items: PlannerCategory[]; groups: PlannerGroup[] };
export const plannerCombinations = withMediaUrls(combinationsFile as unknown as { items: unknown[] });
export const plannerStoreProtocols = withMediaUrls(storeProtocolsFile as unknown as StoreProtocolsFile);
/** GET /session's shop-wide part on live: features, limits, currency, locale, time zone. */
export const plannerSettings = settingsFile as unknown as {
  features: Record<string, boolean>;
  limits: Record<string, number>;
  currency: { code: string; symbol: string; decimals: number; decimal_separator: string; thousand_separator: string; position: string };
  locale: string;
  timezone: string;
};

/** Prices in the planner are decimal strings with the shop's 2 decimals: 85000000n -> "850000.00". */
export function minorToDecimal(minor: bigint): string {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  return `${negative ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

/** Comparing two such prices exactly (no floating point). */
const priceMinor = (price: string) => {
  const [whole, fraction = ""] = price.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
};

/**
 * One planner unit with the shop's current price and stock. null: the shop no longer sells it (the
 * product or the variation is gone), so the planner doesn't offer it either.
 */
function withShopData(unit: PlannerUnit, product: Product, backorder: CatalogState["backorder"]): PlannerUnit | null {
  const variation = unit.variation_id > 0 ? product.variations.find((v) => v.id === unit.variation_id) : null;
  if (unit.variation_id > 0 && !variation) return null;
  if (unit.variation_id === 0 && product.type !== "simple") return null;
  const price = variation ? variation.price : product.priceMin;
  const regular = (variation ? variation.regularPrice : product.regularPrice) ?? price;
  const onSale = Boolean(variation ? variation.onSale : product.onSale);
  const inStock = variation ? variation.inStock : product.inStock;
  // As WooCommerce reports it: out of stock, on backorder (the shop's backorder setting), else in stock.
  const stockStatus = !inStock ? "outofstock" : backorder[String(variation ? variation.id : product.id)] ? "onbackorder" : "instock";
  return { ...unit, price: minorToDecimal(price), regular_price: minorToDecimal(regular), on_sale: onSale, stock_status: stockStatus };
}

export type PlannerState = {
  /** Product id -> the planner's product with today's prices (products the shop sells). */
  products: Map<number, PlannerProduct>;
  /** GET /catalog's list, in live's order, with today's prices. */
  catalog: CatalogItem[];
};

/** The catalogue item's price range, stock count and cheapest option from its (current) units. */
function catalogItemFrom(item: CatalogItem, product: PlannerProduct): CatalogItem | null {
  const ready = product.units.filter((unit) => PLANNABLE.includes(unit.readiness));
  if (!ready.length) return null;
  let cheapest = ready[0];
  for (const unit of ready) if (priceMinor(unit.price) < priceMinor(cheapest.price)) cheapest = unit;
  const prices = ready.map((unit) => priceMinor(unit.price));
  const min = prices.reduce((a, b) => (b < a ? b : a));
  const max = prices.reduce((a, b) => (b > a ? b : a));
  return {
    ...item,
    price_min: minorToDecimal(min),
    price_max: minorToDecimal(max),
    cheapest_capacity: cheapest.capacities[0] ?? null,
    cheapest_pack_count: cheapest.pack_count ?? 1,
    ready_units: ready.length,
    // Options that can be bought now (on backorder counts, as on live).
    in_stock_units: ready.filter((unit) => unit.is_purchasable && unit.stock_status !== "outofstock").length,
  };
}

const states = new WeakMap<CatalogState, PlannerState>();

/** The planner's products and catalogue for the shop's current catalogue (built once per catalogue). */
export async function getPlannerState(): Promise<PlannerState> {
  const shop = await getCatalogState();
  const known = states.get(shop);
  if (known) return known;
  const products = new Map<number, PlannerProduct>();
  for (const product of Object.values(snapshotProducts)) {
    const sold = shop.byId.get(product.id);
    if (!sold) continue;
    const units = product.units.flatMap((unit) => withShopData(unit, sold, shop.backorder) ?? []);
    if (units.length) products.set(product.id, { ...product, units });
  }
  const catalog = snapshotCatalog.flatMap((item) => {
    const product = products.get(item.id);
    return (product && catalogItemFrom(item, product)) || [];
  });
  const state = { products, catalog };
  states.set(shop, state);
  return state;
}

/** "2026-11-11T03:09:47Z": the time stamps the planner API prints (no milliseconds, as PHP). */
export const timestamp = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

/** One product for GET /product/{id} (with "fetched_at" on it and every unit, as live sends). */
export function productResponse(product: PlannerProduct, now = timestamp()) {
  return { ...product, units: product.units.map((unit) => ({ ...unit, fetched_at: now })), fetched_at: now };
}
