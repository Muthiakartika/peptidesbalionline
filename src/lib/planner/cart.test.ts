/**
 * POST /cart of the planner API ("Add all to cart"): the dry run and its conflicts, all or nothing,
 * the visitor's choices for products already in the cart, and a retry with the same request_id. The
 * cart cookie is replaced by a variable here; prices and stock come from the shop's snapshot
 * (CATALOG_SOURCE=snapshot in tests).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredCart } from "@/lib/commerce/cart-cookie";

let stored: StoredCart = { items: [], coupons: [] };
const writes: StoredCart[] = [];
vi.mock("@/lib/commerce/cart-store", () => ({
  readCart: async () => structuredClone(stored),
  writeCart: async (cart: StoredCart) => {
    writes.push(cart);
    stored = structuredClone(cart);
  },
}));

const { postCartAnswer } = await import("./cart");
const { getPlannerState } = await import("./data");

const line = (line_id: string, product_id: number, variation_id: number, quantity: number, on_existing: string | null = null) => ({ line_id, product_id, variation_id, variation_attributes: {}, quantity, on_existing });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Body = { ok: boolean; results: { line_id: string; status: string; quantity_before: number; quantity_after: number; errors: { code: string }[] }[]; cart?: { subtotal: string; item_count: number } };

describe("POST /cart", async () => {
  const { products } = await getPlannerState();
  const post = async (body: unknown) => (await postCartAnswer(body, products, "abcdef0123")).body as unknown as Body;

  beforeEach(() => {
    stored = { items: [], coupons: [] };
    writes.length = 0;
  });

  it("checks the lines in a dry run without changing the cart", async () => {
    const body = await post({ request_id: uuid(1), dry_run: true, lines: [line("l_a", 991, 5635, 3), line("l_b", 6218, 0, 1)] });
    expect(body.ok).toBe(true);
    expect(body.results.map((r) => r.status)).toEqual(["ok", "ok"]);
    expect(writes).toHaveLength(0);
  });

  it("adds every line at once, and a retry with the same request_id adds nothing more", async () => {
    const request = { request_id: uuid(2), dry_run: false, lines: [line("l_a", 991, 5635, 3), line("l_b", 6218, 0, 1)] };
    const body = await post(request);
    expect(body.ok).toBe(true);
    expect(body.results.map((r) => [r.status, r.quantity_after])).toEqual([
      ["added", 3],
      ["added", 1],
    ]);
    expect(stored.items).toEqual([
      { productId: 991, variationId: 5635, quantity: 3 },
      { productId: 6218, variationId: null, quantity: 1 },
    ]);
    // 3 × Rp850,000 + Rp1,400,000: the shop's own prices.
    expect(body.cart).toMatchObject({ subtotal: "Rp3,950,000.00", item_count: 4 });
    expect(await post(request)).toEqual(body);
    expect(writes).toHaveLength(1);
  });

  it("reports products already in the cart, then follows the visitor's choice", async () => {
    stored = { items: [{ productId: 991, variationId: 5635, quantity: 2 }, { productId: 6218, variationId: null, quantity: 5 }], coupons: [] };
    const dry = await post({ request_id: uuid(3), dry_run: true, lines: [line("l_a", 991, 5635, 3), line("l_b", 6218, 0, 1), line("l_c", 1217, 5708, 1)] });
    expect(dry.results.map((r) => [r.status, r.quantity_before])).toEqual([
      ["conflict", 2],
      ["conflict", 5],
      ["ok", 0],
    ]);
    const body = await post({ request_id: uuid(4), dry_run: false, lines: [line("l_a", 991, 5635, 3, "increase"), line("l_b", 6218, 0, 1, "set"), line("l_c", 1217, 5708, 1)] });
    expect(body.results.map((r) => [r.status, r.quantity_after])).toEqual([
      ["updated", 5],
      ["updated", 1],
      ["added", 1],
    ]);
    const skipped = await post({ request_id: uuid(5), dry_run: false, lines: [line("l_a", 991, 5635, 3, "skip")] });
    expect(skipped.results[0]).toMatchObject({ status: "skipped", quantity_after: 5 });
  });

  it("adds nothing when one line can't be added (all or nothing)", async () => {
    // BPC-157 20 MG needs mapping; HGH 24 IU is out of stock.
    const body = await post({ request_id: uuid(6), dry_run: false, lines: [line("l_a", 991, 5635, 3), line("l_b", 991, 12451, 1), line("l_c", 1217, 10062, 1)] });
    expect(body.ok).toBe(false);
    expect(body.results.map((r) => [r.status, r.errors[0]?.code])).toEqual([
      ["ok", undefined],
      ["error", "needs_mapping"],
      ["error", "out_of_stock"],
    ]);
    expect(writes).toHaveLength(0);
  });

  it("answers WordPress's argument errors", async () => {
    expect(await post({ lines: [] })).toMatchObject({ code: "rest_missing_callback_param" });
    expect(await post({ request_id: "x", lines: [] })).toMatchObject({ code: "rest_invalid_param", data: { params: { request_id: "request_id is not a valid UUID." } } });
  });
});
