/**
 * GET / POST /cart of the planner API: the Protocol Builder's "Add all to cart", into this site's own
 * cart (the cart cookie: src/lib/commerce/cart-store.ts). As in the plugin (components/cart.js):
 *
 *   1. planner.js first sends the protocol's lines with `dry_run: true`: nothing changes, every line is
 *      checked, and a line whose product is already in the cart comes back as a "conflict" with the
 *      quantity there (`quantity_before`);
 *   2. the visitor chooses per conflict: add to it ("increase"), replace it ("set") or skip it;
 *   3. planner.js sends the lines again with a new `request_id` and `dry_run: false`. It is all or
 *      nothing: if one line can't be added, nothing is (`ok: false` and the reasons per line).
 *      The same `request_id` sent again (a retry after a lost answer) gets the first answer back,
 *      so a line is never added twice.
 * Each line is checked like the shop's own "Add to cart" (checkAddToCart: the product and option
 * exist, are in stock, the quantity is 1–9999), and must be an option the planner can calculate.
 * Prices are never taken from the request: the cart prices itself (priceCart).
 */
import "server-only";

import { createHash } from "node:crypto";

import { encodeCart, type StoredCart } from "@/lib/commerce/cart-cookie";
import { cartCouponState, withoutCoupons } from "@/lib/commerce/cart-coupons";
import { checkAddToCart, lineKey, MAX_QUANTITY, priceCart } from "@/lib/commerce/cart-lines";
import { readCart, writeCart } from "@/lib/commerce/cart-store";
import { computeTotals } from "@/lib/commerce/totals";
import { formatMoney } from "@/lib/money";

import { MAX_LINES } from "./calculate";
import { PLANNABLE, type PlannerProduct } from "./data";
import { PLANNER_URLS } from "./config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINE_ID = /^[a-z0-9_-]{1,40}$/;
const ON_EXISTING = [null, "increase", "set", "skip"] as const;
type OnExisting = (typeof ON_EXISTING)[number];

type LineError = { code: string; message: string };
type Result = {
  line_id: string;
  status: "ok" | "conflict" | "added" | "updated" | "skipped" | "error";
  product_id: number;
  variation_id: number;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  errors: LineError[];
};

export type CartAnswer = { status: number; body: Record<string, unknown> };

/** The cart's totals as planner.js shows them after adding ("Cart subtotal", "Cart total"). */
async function cartSummary(cart: StoredCart) {
  const { lines } = await priceCart(cart.items);
  const coupons = lines.length ? await cartCouponState(cart, lines) : null;
  const totals = computeTotals({ lines, coupons: coupons?.coupons ?? [] });
  return {
    item_count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: formatMoney(totals.subtotal),
    discount: formatMoney(totals.discount),
    total: formatMoney(totals.total),
    coupons: (coupons?.coupons ?? []).map((coupon) => coupon.code),
    cart_url: PLANNER_URLS.cart,
    checkout_url: PLANNER_URLS.checkout,
  };
}

/** Like WooCommerce's cart hash: changes whenever the cart's contents change. */
const cartHash = (cart: StoredCart) => createHash("md5").update(encodeCart(cart)).digest("hex");

/** GET /cart: what the cart holds, with its totals. */
export async function getCartAnswer(): Promise<CartAnswer> {
  const cart = await readCart();
  const { lines } = await priceCart(cart.items);
  return {
    status: 200,
    body: {
      items: lines.map((line) => ({ key: line.key, product_id: line.productId, variation_id: line.variationId ?? 0, name: line.name, variant: line.variantLabel ?? "", quantity: line.quantity })),
      cart: await cartSummary(cart),
      cart_hash: cartHash(cart),
    },
  };
}

/** Recent answers by request_id (15 minutes, as the plugin keeps them), so a retry never adds twice. */
const answered = new Map<string, { at: number; answer: CartAnswer }>();
const KEEP_MS = 15 * 60 * 1000;

function remembered(requestId: string): CartAnswer | null {
  const now = Date.now();
  for (const [id, entry] of answered) if (now - entry.at > KEEP_MS) answered.delete(id);
  return answered.get(requestId.toLowerCase())?.answer ?? null;
}

const invalidParam = (name: string, message: string, code: string, details: unknown = undefined): CartAnswer => ({
  status: 400,
  body: { code: "rest_invalid_param", message: `Invalid parameter(s): ${name}`, data: { status: 400, params: { [name]: message }, details: details ?? { [name]: { code, message, data: null } } } },
});

const isWhole = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;

/** POST /cart (see above). `nonce` is the visitor's planner nonce, returned as live does. */
export async function postCartAnswer(body: unknown, products: Map<number, PlannerProduct>, nonce: string): Promise<CartAnswer> {
  const request = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const missing = ["request_id", "lines"].filter((name) => !(name in request));
  if (missing.length) return { status: 400, body: { code: "rest_missing_callback_param", message: `Missing parameter(s): ${missing.join(", ")}`, data: { status: 400, params: missing } } };
  if (typeof request.request_id !== "string" || !UUID.test(request.request_id)) return invalidParam("request_id", "request_id is not a valid UUID.", "rest_invalid_uuid");
  const dryRun = request.dry_run ?? false;
  if (typeof dryRun !== "boolean") return invalidParam("dry_run", "dry_run is not of type boolean.", "rest_invalid_type");
  if (!Array.isArray(request.lines)) return invalidParam("lines", "Invalid parameter.", "", []);
  if (request.lines.length === 0 || request.lines.length > MAX_LINES) {
    const message = request.lines.length === 0 ? "Add at least one item." : `A protocol can have at most ${MAX_LINES} items. Remove some items and try again.`;
    return { status: 400, body: { code: "arp_invalid_request", message: "The request could not be processed. Please reload the page and try again.", data: { errors: [{ field: "lines", code: request.lines.length === 0 ? "required" : "too_many_lines", message }], status: 400 } } };
  }
  if (!dryRun) {
    const previous = remembered(request.request_id);
    if (previous) return previous;
  }

  const cart = await readCart();
  /** What the cart held before this request, per product and option. */
  const before = new Map(cart.items.map((item) => [lineKey(item.productId, item.variationId), item.quantity]));
  const working = new Map(before);
  /** Units this request already set ("set" replaces the cart's quantity once, then adds). */
  const replaced = new Set<string>();
  const results: Result[] = [];

  for (const raw of request.lines) {
    const line = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const lineId = typeof line.line_id === "string" ? line.line_id : "";
    const productId = isWhole(line.product_id, 1, Number.MAX_SAFE_INTEGER) ? line.product_id : 0;
    const variationId = isWhole(line.variation_id ?? 0, 0, Number.MAX_SAFE_INTEGER) ? Number(line.variation_id ?? 0) : -1;
    const quantity = isWhole(line.quantity, 1, MAX_QUANTITY) ? line.quantity : 0;
    const onExisting = (ON_EXISTING as readonly unknown[]).includes(line.on_existing ?? null) ? ((line.on_existing ?? null) as OnExisting) : undefined;
    const result: Result = { line_id: lineId, status: "ok", product_id: productId, variation_id: Math.max(0, variationId), quantity, quantity_before: 0, quantity_after: 0, errors: [] };
    results.push(result);
    const fail = (code: string, message: string) => {
      result.status = "error";
      result.errors.push({ code, message });
    };
    if (!LINE_ID.test(lineId)) fail("invalid_id", "The identifier is not valid.");
    if (!productId || variationId < 0) fail("invalid_id", "The identifier is not valid.");
    if (!quantity) fail("out_of_range", "Please enter a valid quantity.");
    if (onExisting === undefined) fail("invalid_type", "This value has the wrong type or format.");
    if (result.status === "error") continue;

    // Only options the planner offers and can calculate.
    const unit = products.get(productId)?.units.find((u) => u.variation_id === variationId);
    if (!unit || !PLANNABLE.includes(unit.readiness)) {
      fail(unit ? unit.readiness : "product_not_found", unit ? unit.readiness_message : "This product could not be found.");
      continue;
    }
    // The shop's own checks (exists, in stock, quantity), with WooCommerce's messages.
    const check = await checkAddToCart(productId, variationId || null, quantity);
    if (!check.ok) {
      fail(/out of stock/i.test(check.error) ? "out_of_stock" : "not_purchasable", check.link ? `${check.error} ${check.link.text}.` : check.error);
      continue;
    }

    const key = lineKey(productId, variationId || null);
    const existing = before.get(key) ?? 0;
    result.quantity_before = working.get(key) ?? 0;
    if (dryRun) {
      if (existing > 0) result.status = "conflict";
      result.quantity_before = existing;
      continue;
    }
    if (existing > 0 && onExisting === "skip") {
      result.status = "skipped";
      result.quantity_after = result.quantity_before;
      continue;
    }
    let next: number;
    if (existing > 0 && onExisting === "set" && !replaced.has(key)) {
      replaced.add(key);
      next = quantity;
    } else {
      next = (working.get(key) ?? 0) + quantity;
    }
    if (next > MAX_QUANTITY) {
      fail("out_of_range", `The quantity in your cart can be at most ${MAX_QUANTITY}.`);
      continue;
    }
    working.set(key, next);
    result.status = result.quantity_before > 0 ? "updated" : "added";
    result.quantity_after = next;
  }

  const ok = results.every((result) => result.status !== "error");
  if (!ok && !dryRun) {
    // Nothing was added: the other lines only could have been.
    for (const result of results) {
      if (result.status === "error") continue;
      result.status = "ok";
      result.quantity_after = result.quantity_before;
    }
  }
  if (dryRun || !ok) {
    // Nothing changes: a dry run, or a line that can't be added (all or nothing).
    return { status: 200, body: { ok, dry_run: dryRun, results, nonce } };
  }

  // Every line can be added: save the cart once. Coupons the new contents make invalid are removed,
  // as the shop's own "Add to cart" does.
  const changed: StoredCart = { ...cart, items: [...cart.items.filter((item) => working.has(lineKey(item.productId, item.variationId)))] };
  const keys = new Set(changed.items.map((item) => lineKey(item.productId, item.variationId)));
  changed.items = changed.items.map((item) => ({ ...item, quantity: working.get(lineKey(item.productId, item.variationId)) ?? item.quantity }));
  for (const [key, quantity] of working) {
    if (keys.has(key)) continue;
    const [productId, variationId] = key.split(":").map(Number);
    changed.items.push({ productId, variationId: variationId || null, quantity });
  }
  const { lines } = await priceCart(changed.items);
  const coupons = lines.length ? await cartCouponState(changed, lines) : null;
  const saved = coupons?.removedCodes.length ? withoutCoupons(changed, coupons.removedCodes) : changed;
  await writeCart(saved);

  const answer: CartAnswer = { status: 200, body: { ok: true, dry_run: false, results, cart: await cartSummary(saved), cart_hash: cartHash(saved), fragments: {}, nonce } };
  answered.set(request.request_id.toLowerCase(), { at: Date.now(), answer });
  return answer;
}
