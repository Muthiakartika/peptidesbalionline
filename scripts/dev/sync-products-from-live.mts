/**
 * Sync (11 Nov 2026) of what the owner changed on the live WordPress shop after the rebuild's copy
 * was made, applied through the store admin's own updateProduct (same checks and Sanity sync as
 * /admin/products/). Live values come from the public WooCommerce Store API
 * (/wp-json/wc/store/v1/products), read when the script runs.
 *
 *   1. Prices / variations found different on 11 Nov:
 *        871  NAD+       new variation 100 MG (live variation 12787) at Rp1,300,000, first in the list
 *        1226 Oxytocin   2 MG (variation 5760) Rp800,000 -> Rp1,000,000
 *   2. Stock status of EVERY product and variation: in stock / out of stock / on backorder as on live.
 *      Rows whose stock is managed with a quantity in the rebuild are only reported (change them in
 *      /admin/products/).
 *
 * Run from the project folder (reads DATABASE_URL from .env.local). CATALOG_SOURCE=snapshot is needed:
 * the admin's input check reads the categories, and outside Next.js the database catalogue's cache
 * (cacheTag) isn't available, so the snapshot's categories are used for that check only.
 *   CATALOG_SOURCE=snapshot npx tsx --conditions=react-server --env-file=.env.local scripts/dev/sync-products-from-live.mts          (dry run)
 *   CATALOG_SOURCE=snapshot npx tsx --conditions=react-server --env-file=.env.local scripts/dev/sync-products-from-live.mts --apply
 * Applied on 11 Nov 2026 (8 products); running it again only changes what differs from live by then.
 */
import { getEditorProduct, listAdminProducts, updateProduct, type EditorProduct } from "@/lib/commerce/product-admin";

const apply = process.argv.includes("--apply");
const ACTOR = "sync-from-live-2026-11-11";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0 Safari/537.36" };
type Variant = EditorProduct["variants"][number];
type LiveState = "instock" | "outofstock" | "onbackorder";

/** Runs `task` over `items`, `limit` at a time, keeping the order. */
async function pool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await task(items[i]);
      }
    }),
  );
  return out;
}

/** Live stock state by product / variation id, 100 ids per Store API request. */
async function liveStates(ids: number[], type: "variation" | null): Promise<Map<number, LiveState>> {
  const states = new Map<number, LiveState>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const url = `https://peptidesbali.online/wp-json/wc/store/v1/products?include=${chunk.join(",")}&per_page=100${type ? `&type=${type}` : ""}&_fresh=${Date.now()}`;
    let rows: { id: number; is_in_stock: boolean; is_on_backorder: boolean }[] | null = null;
    for (let attempt = 0; attempt < 4 && !rows; attempt++) {
      const res = await fetch(url, { headers: UA });
      if (res.ok) rows = await res.json();
      else await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
    if (!rows) throw new Error(`live Store API did not answer (${url})`);
    for (const p of rows) states.set(p.id, p.is_on_backorder ? "onbackorder" : p.is_in_stock ? "instock" : "outofstock");
  }
  return states;
}

/** 1. The two price / variation changes. */
const explicit: Record<number, { describe: string; edit: (p: EditorProduct) => EditorProduct }> = {
  871: {
    describe: "add 100 MG (Rp1,300,000) before 500 MG",
    edit: (p) => {
      if (p.variants.some((v) => v.attributes.attribute_pa_mg === "100-mg")) return p;
      const template = p.variants.find((v) => v.attributes.attribute_pa_mg === "500-mg") ?? p.variants[0];
      const attributes = p.attributes.map((a) =>
        a.name === "attribute_pa_mg" && !a.options.some((o) => o.value === "100-mg") ? { ...a, options: [{ value: "100-mg", label: "100 MG" }, ...a.options] } : a,
      );
      const added = { ...template, id: undefined, shopId: 12787, attributes: { ...template.attributes, attribute_pa_mg: "100-mg" }, regularPrice: 1_300_000, salePrice: null, saleFrom: null, saleTo: null, sku: "", enabled: true, manageStock: false, stockQuantity: null, stockStatus: "instock", backorders: "no" } as unknown as Variant;
      return { ...p, attributes, variants: [added, ...p.variants] };
    },
  },
  1226: {
    describe: "2 MG Rp1,000,000",
    edit: (p) => ({ ...p, variants: p.variants.map((v) => (v.attributes.attribute_pa_mg === "2-mg" ? { ...v, regularPrice: 1_000_000, salePrice: null, saleFrom: null, saleTo: null } : v)) }),
  },
};

const line = (v: Variant) => `${JSON.stringify(v.attributes)} Rp${v.regularPrice.toLocaleString("en")}${v.salePrice ? ` sale Rp${v.salePrice.toLocaleString("en")}` : ""} ${v.stockStatus}${v.manageStock ? ` qty ${v.stockQuantity}` : ""} backorders=${v.backorders}`;

const rows = (await listAdminProducts()).filter((row) => row.status !== "archived");
const editors = (await pool(rows, 6, (row) => getEditorProduct(row.shopId))).filter((p): p is EditorProduct => p !== null);
console.log(`Read ${editors.length} products from the database.`);
const simpleIds = editors.filter((p) => p.type === "simple").map((p) => p.shopId);
const variationIds = editors.filter((p) => p.type === "variable").flatMap((p) => p.variants.map((v) => v.shopId).filter((id): id is number => typeof id === "number"));
const live = new Map([...(await liveStates(simpleIds, null)), ...(await liveStates(variationIds, "variation"))]);
console.log(`Read ${live.size} stock states from live (${simpleIds.length} simple products, ${variationIds.length} variations asked).`);

const plans: { before: EditorProduct; after: EditorProduct; notes: string[] }[] = [];
const manual: string[] = [];
for (const before of editors) {
  let after = explicit[before.shopId]?.edit(before) ?? before;
  // Listed only while it still changes something (the script can be run again safely).
  const notes: string[] = explicit[before.shopId] && JSON.stringify(after) !== JSON.stringify(before) ? [explicit[before.shopId].describe] : [];
  // 2. Stock status as on live.
  after = {
    ...after,
    variants: after.variants.map((v) => {
      const id = before.type === "variable" ? v.shopId : before.shopId;
      const state = id ? live.get(id) : undefined;
      if (!state || state === v.stockStatus) return v;
      if (v.manageStock) {
        manual.push(`#${before.shopId} ${before.name.slice(0, 40)} ${JSON.stringify(v.attributes)}: rebuild ${v.stockStatus} (managed, qty ${v.stockQuantity}), live ${state}`);
        return v;
      }
      notes.push(`${JSON.stringify(v.attributes)} ${v.stockStatus} -> ${state}`);
      return { ...v, stockStatus: state, backorders: state === "onbackorder" ? (v.backorders === "no" ? "notify" : v.backorders) : "no" };
    }),
  };
  if (notes.length) plans.push({ before, after, notes });
}

for (const { before, after, notes } of plans) {
  console.log(`\n#${before.shopId} ${before.name}: ${notes.join("; ")}\n  before: ${before.variants.map(line).join("\n          ")}\n  after:  ${after.variants.map(line).join("\n          ")}`);
  if (!apply) continue;
  const result = await updateProduct(before.shopId, after, ACTOR);
  console.log(`  -> ${result.ok ? "saved" : `FAILED: ${result.error}`}${result.ok && result.warning ? ` (warning: ${result.warning})` : ""}`);
}
if (manual.length) console.log(`\nManaged stock, change by hand in /admin/products/:\n  ${manual.join("\n  ")}`);
console.log(`\n${editors.length} products checked, ${plans.length} to change. ${apply ? "Saved." : "Dry run: nothing written. Add --apply to save."}`);
process.exit(0);
