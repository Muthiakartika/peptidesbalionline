"use client";

/**
 * The product form (add and edit): name, address, status, type, categories, order and date; for a
 * simple product its price, sale and stock; for a variable product its attributes (a shop-wide one
 * such as MG with the values ticked, or one typed for this product only) and one row per variation with
 * its own price, sale and stock. Archive / restore / delete live at the bottom. Texts and pictures are
 * edited in Sanity (link at the top).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { EditorProduct, EditorVariant, ProductInput } from "@/lib/commerce/product-admin";
import { customAttributeName, shopAttributeName, slugify } from "@/lib/commerce/slug";

import { archiveProductAction, deleteProductAction, restoreProductAction, saveProductAction } from "./actions";

type Category = { slug: string; name: string; id: number; parent: number };
/** A shop-wide attribute (/admin/attributes/). */
export type ShopAttribute = { slug: string; label: string; swatches: boolean; terms: { value: string; label: string }[] };
type Attribute = ProductInput["attributes"][number];
type Variant = Omit<EditorVariant, "id" | "shopId"> & { id?: string; shopId?: number | null; key: string };

const input = "w-full rounded border border-[#8c8f94] px-2 py-1 text-[13px]";
const label = "mb-1 block text-[13px] font-semibold";
const box = "mb-4 border border-[#c3c4c7] bg-white";
const boxTitle = "border-b border-[#c3c4c7] px-3 py-2 font-semibold";

let counter = 0;
const newKey = () => `new-${++counter}`;

const emptyVariant = (attributes: Record<string, string> = {}): Variant => ({
  key: newKey(),
  attributes,
  regularPrice: 0,
  salePrice: null,
  saleFrom: null,
  saleTo: null,
  sku: null,
  enabled: true,
  manageStock: false,
  stockQuantity: null,
  stockStatus: "instock",
  backorders: "no",
  image: null,
});

/** "2026-11-09T00:00:00.000Z" → "2026-11-09" for <input type="date"> (site time = UTC). */
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const fromDay = (value: string) => (value ? `${value}T00:00:00.000Z` : null);
const digits = (value: string) => {
  const n = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function PriceAndStock({ variant, onChange, compact = false }: { variant: Variant; onChange: (v: Variant) => void; compact?: boolean }) {
  const set = (patch: Partial<Variant>) => onChange({ ...variant, ...patch });
  return (
    <div className={compact ? "grid grid-cols-2 gap-2 md:grid-cols-4" : "grid gap-3 md:grid-cols-2"}>
      <div>
        <span className={label}>Regular price (Rp)</span>
        <input className={input} inputMode="numeric" value={variant.regularPrice ? variant.regularPrice.toLocaleString("id-ID") : ""} onChange={(e) => set({ regularPrice: digits(e.target.value) })} placeholder="e.g. 850.000" />
      </div>
      <div>
        <span className={label}>Sale price (Rp)</span>
        <input
          className={input}
          inputMode="numeric"
          value={variant.salePrice ? variant.salePrice.toLocaleString("id-ID") : ""}
          onChange={(e) => set({ salePrice: e.target.value.trim() ? digits(e.target.value) : null })}
          placeholder="empty = no sale"
        />
      </div>
      <div>
        <span className={label}>Sale from</span>
        <input type="date" className={input} value={day(variant.saleFrom)} onChange={(e) => set({ saleFrom: fromDay(e.target.value) })} />
      </div>
      <div>
        <span className={label}>Sale until</span>
        <input type="date" className={input} value={day(variant.saleTo)} onChange={(e) => set({ saleTo: fromDay(e.target.value) })} />
      </div>
      <div>
        <span className={label}>SKU</span>
        <input className={input} value={variant.sku ?? ""} onChange={(e) => set({ sku: e.target.value || null })} />
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
          <input type="checkbox" checked={variant.manageStock} onChange={(e) => set({ manageStock: e.target.checked, stockQuantity: e.target.checked ? (variant.stockQuantity ?? 0) : null })} />
          Manage stock (count)
        </label>
        {variant.manageStock ? (
          <input className={input} inputMode="numeric" value={variant.stockQuantity ?? 0} onChange={(e) => set({ stockQuantity: digits(e.target.value) })} />
        ) : (
          <select className={input} value={variant.stockStatus} onChange={(e) => set({ stockStatus: e.target.value as Variant["stockStatus"] })}>
            <option value="instock">In stock</option>
            <option value="outofstock">Out of stock</option>
            <option value="onbackorder">On backorder</option>
          </select>
        )}
      </div>
      <div>
        <span className={label}>Backorders</span>
        <select className={input} value={variant.backorders} onChange={(e) => set({ backorders: e.target.value as Variant["backorders"] })}>
          <option value="no">Do not allow</option>
          <option value="notify">Allow, but notify customer</option>
          <option value="yes">Allow</option>
        </select>
      </div>
    </div>
  );
}

export function ProductEditor({ initial, categories, shopAttributes }: { initial: EditorProduct | null; categories: Category[]; shopAttributes: ShopAttribute[] }) {
  const shopByName = new Map(shopAttributes.map((a) => [shopAttributeName(a.slug), a]));
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "ok" | "warn"; text: string } | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [status, setStatus] = useState<ProductInput["status"]>(initial?.status ?? "draft");
  const [type, setType] = useState<ProductInput["type"]>(initial?.type ?? "simple");
  const [categorySlugs, setCategorySlugs] = useState<string[]>(initial?.categorySlugs ?? []);
  const [menuOrder, setMenuOrder] = useState(initial?.menuOrder ?? 0);
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? null);
  const [attributes, setAttributes] = useState<Attribute[]>(initial?.attributes ?? []);
  const [variants, setVariants] = useState<Variant[]>(() => (initial?.variants.length ? initial.variants.map((v) => ({ ...v, key: v.id })) : [emptyVariant()]));

  const ordered = useMemo(() => {
    const byParent = (parent: number, depth: number): (Category & { depth: number })[] =>
      categories
        .filter((c) => c.parent === parent)
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((c) => [{ ...c, depth }, ...byParent(c.id, depth + 1)]);
    return byParent(0, 0);
  }, [categories]);

  const archived = initial?.storeStatus === "archived";
  const payload = (): ProductInput => ({
    name,
    slug,
    status,
    type,
    categorySlugs,
    menuOrder,
    publishedAt,
    attributes: type === "variable" ? attributes : [],
    variants: (type === "simple" ? variants.slice(0, 1) : variants).map((v) => {
      const { key, shopId, ...rest } = v;
      void key;
      void shopId;
      return { ...rest, attributes: type === "simple" ? {} : rest.attributes };
    }),
  });

  const run = (action: () => Promise<{ ok: true; shopId: number; warning?: string } | { ok: false; error: string }>, success: string, after?: (shopId: number) => void) =>
    start(async () => {
      setMessage(null);
      try {
        const result = await action();
        if (!result.ok) setMessage({ tone: "error", text: result.error });
        else {
          setMessage(result.warning ? { tone: "warn", text: `${success} ${result.warning}` } : { tone: "ok", text: success });
          if (after) after(result.shopId);
          else router.refresh();
        }
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "Something went wrong." });
      }
    });

  const save = () =>
    run(() => saveProductAction(initial?.shopId ?? null, payload()), initial ? "Product updated." : "Product created.", initial ? undefined : (shopId) => router.push(`/admin/products/${shopId}/?created=1`));

  const setAttribute = (index: number, patch: Partial<Attribute>) => setAttributes(attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  /** Values typed as "5 MG, 10 MG": existing values keep their stored value (variations use it). */
  const setOptionLabels = (index: number, text: string) => {
    const current = attributes[index];
    const labels = text.split(",").map((s) => s.trim()).filter(Boolean);
    setAttribute(index, { options: labels.map((l) => current.options.find((o) => o.label === l) ?? { label: l }) });
  };
  // The keys the server will save (src/lib/commerce/product-admin.ts): variations are keyed by them.
  const nameOf = (a: Attribute, i: number) => a.name || (a.label ? customAttributeName(a.label) : `new-attribute-${i}`);
  const valueOf = (o: Attribute["options"][number]) => o.value || slugify(o.label);
  /** Tick or untick a shop-wide attribute's value (kept in the attribute's own order). */
  const toggleTerm = (index: number, shop: ShopAttribute, value: string, on: boolean) => {
    const chosen = new Set(attributes[index].options.map((o) => o.value));
    if (on) chosen.add(value);
    else chosen.delete(value);
    setAttribute(index, { options: shop.terms.filter((t) => chosen.has(t.value)).map((t) => ({ value: t.value, label: t.label })) });
  };
  const addAttribute = (choice: string) => {
    const shop = shopAttributes.find((a) => a.slug === choice);
    if (shop) setAttributes([...attributes, { name: shopAttributeName(shop.slug), label: shop.label, swatches: shop.swatches, options: [], default: null }]);
    else if (choice === "custom") setAttributes([...attributes, { label: "", swatches: true, options: [], default: null }]);
  };

  const generate = () => {
    if (!attributes.length) return;
    const combos = attributes.reduce<Record<string, string>[]>(
      (acc, a, i) => acc.flatMap((combo) => a.options.map((o) => ({ ...combo, [nameOf(a, i)]: valueOf(o) }))),
      [{}],
    );
    const has = (combo: Record<string, string>) => variants.some((v) => attributes.every((a, i) => (v.attributes[nameOf(a, i)] ?? "") === combo[nameOf(a, i)]));
    setVariants([...variants.filter((v) => Object.keys(v.attributes).length || type === "simple"), ...combos.filter((c) => !has(c)).map((c) => emptyVariant(c))]);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-normal">{initial ? "Edit product" : "Add new product"}</h1>
        {initial ? (
          <>
            {initial.storeStatus === "publish" ? (
              <a href={`/product/${initial.slug}/`} target="_blank" rel="noreferrer" className="text-[13px] text-[#2271b1]">
                View product ↗
              </a>
            ) : null}
            <a href={`/studio/structure/product;${initial.sanityId}`} target="_blank" rel="noreferrer" className="rounded border border-[#2271b1] px-2.5 py-1 text-[13px] text-[#2271b1]">
              Edit texts &amp; pictures in Sanity ↗
            </a>
          </>
        ) : null}
        <Link href="/admin/products/" className="ml-auto text-[13px] text-[#2271b1]">
          ← All products
        </Link>
      </div>
      {archived ? <p className="mb-3 border-l-4 border-[#dba617] bg-white px-3 py-2 text-[13px]">This product is archived: it is hidden from the shop (its address shows “not found”). Restore it to show it again.</p> : null}
      {message ? (
        <p className={`mb-3 border-l-4 bg-white px-3 py-2 text-[13px] ${message.tone === "error" ? "border-[#d63638]" : message.tone === "warn" ? "border-[#dba617]" : "border-[#00a32a]"}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <section className={box}>
            <div className="grid gap-3 p-3">
              <div>
                <span className={label}>Product name</span>
                <input className={`${input} text-[16px]`} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <span className={label}>Address</span>
                <div className="flex items-center gap-1 text-[13px]">
                  <span className="text-[#646970]">/product/</span>
                  <input className={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="made from the name when empty" />
                  <span className="text-[#646970]">/</span>
                </div>
                {initial && slug && slug !== initial.slug ? <p className="mt-1 text-[12px] text-[#996800]">The old address will forward to the new one automatically (301, as WordPress does), so links to it keep working.</p> : null}
              </div>
            </div>
          </section>

          <section className={box}>
            <div className={`${boxTitle} flex items-center gap-3`}>
              Product data —
              <select className="rounded border border-[#8c8f94] px-1 py-0.5 text-[13px] font-normal" value={type} disabled={Boolean(initial)} onChange={(e) => setType(e.target.value as ProductInput["type"])}>
                <option value="simple">Simple product</option>
                <option value="variable">Variable product</option>
              </select>
              {initial ? <span className="text-[12px] font-normal text-[#646970]">(the type can&apos;t change after creating)</span> : null}
            </div>
            <div className="p-3">
              {type === "simple" ? (
                <PriceAndStock variant={variants[0]} onChange={(v) => setVariants([v, ...variants.slice(1)])} />
              ) : (
                <>
                  <h3 className="mb-2 text-[14px] font-semibold">Attributes</h3>
                  {attributes.map((a, i) => {
                    const shop = a.name ? shopByName.get(a.name) : undefined;
                    if (shop) {
                      const chosen = new Set(a.options.map((o) => o.value));
                      return (
                        <div key={i} className="mb-2 rounded border border-[#dcdcde] p-2">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-[13px] font-semibold">{shop.label}</span>
                            <span className="rounded bg-[#f0f6fc] px-1 text-[11px] text-[#2271b1]">shop-wide · {shop.swatches ? "pills" : "dropdown"}</span>
                            <a href={`/admin/attributes/${shop.slug}/`} target="_blank" rel="noreferrer" className="text-[12px] text-[#2271b1]">
                              edit values ↗
                            </a>
                            <button type="button" className="ml-auto text-[13px] text-[#b32d2e]" onClick={() => setAttributes(attributes.filter((_, j) => j !== i))}>
                              Remove
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {shop.terms.map((t) => (
                              <label key={t.value} className="flex items-center gap-1 text-[13px]">
                                <input type="checkbox" checked={chosen.has(t.value)} onChange={(e) => toggleTerm(i, shop, t.value, e.target.checked)} />
                                {t.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="mb-2 grid items-end gap-2 rounded border border-[#dcdcde] p-2 md:grid-cols-[160px_1fr_auto_auto]">
                        <div>
                          <span className={label}>Name (this product only)</span>
                          <input className={input} value={a.label} onChange={(e) => setAttribute(i, { label: e.target.value })} placeholder="e.g. Vial Size" />
                        </div>
                        <div>
                          <span className={label}>Values (comma separated)</span>
                          <input className={input} defaultValue={a.options.map((o) => o.label).join(", ")} onBlur={(e) => setOptionLabels(i, e.target.value)} placeholder="e.g. 3ml, 10ml" />
                        </div>
                        <label className="flex items-center gap-1 pb-1 text-[13px]">
                          <input type="checkbox" checked={a.swatches} onChange={(e) => setAttribute(i, { swatches: e.target.checked })} /> Pills
                        </label>
                        <button type="button" className="pb-1 text-[13px] text-[#b32d2e]" onClick={() => setAttributes(attributes.filter((_, j) => j !== i))}>
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {attributes.length < 3 ? (
                    <select className="mb-4 rounded border border-[#8c8f94] px-1 py-0.5 text-[13px] text-[#2271b1]" value="" onChange={(e) => addAttribute(e.target.value)}>
                      <option value="">+ Add attribute…</option>
                      {shopAttributes
                        .filter((shop) => !attributes.some((a) => a.name === shopAttributeName(shop.slug)))
                        .map((shop) => (
                          <option key={shop.slug} value={shop.slug}>
                            {shop.label}
                          </option>
                        ))}
                      <option value="custom">Custom attribute (this product only)</option>
                    </select>
                  ) : null}

                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-[14px] font-semibold">Variations ({variants.length})</h3>
                    <button type="button" className="text-[13px] text-[#2271b1]" onClick={generate}>
                      Create all combinations
                    </button>
                    <button type="button" className="text-[13px] text-[#2271b1]" onClick={() => setVariants([...variants, emptyVariant()])}>
                      + Add variation
                    </button>
                  </div>
                  {variants.map((v, index) => (
                    <div key={v.key} className={`mb-2 rounded border p-2 ${v.enabled ? "border-[#dcdcde]" : "border-dashed border-[#c3c4c7] opacity-70"}`}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-[12px] text-[#646970]">#{v.shopId ?? "new"}</span>
                        {attributes.map((a, i) => (
                          <select
                            key={i}
                            className="rounded border border-[#8c8f94] px-1 py-0.5 text-[13px]"
                            value={v.attributes[nameOf(a, i)] ?? ""}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === index ? { ...x, attributes: { ...x.attributes, [nameOf(a, i)]: e.target.value } } : x)))}
                          >
                            <option value="">Any {a.label || "value"}</option>
                            {a.options.map((o) => (
                              <option key={valueOf(o)} value={valueOf(o)}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ))}
                        <label className="flex items-center gap-1 text-[13px]">
                          <input type="checkbox" checked={v.enabled} onChange={(e) => setVariants(variants.map((x, j) => (j === index ? { ...x, enabled: e.target.checked } : x)))} /> Enabled
                        </label>
                        <button type="button" className="ml-auto text-[13px] text-[#b32d2e]" onClick={() => setVariants(variants.filter((_, j) => j !== index))}>
                          Remove
                        </button>
                      </div>
                      <PriceAndStock compact variant={v} onChange={(next) => setVariants(variants.map((x, j) => (j === index ? next : x)))} />
                    </div>
                  ))}
                  <p className="text-[12px] text-[#646970]">A variation with price 0 can&apos;t be bought. A removed variation that was ordered before is disabled instead (orders keep it).</p>
                </>
              )}
            </div>
          </section>
        </div>

        <aside>
          <section className={box}>
            <div className={boxTitle}>Publish</div>
            <div className="grid gap-3 p-3">
              <div>
                <span className={label}>Status</span>
                <select className={input} value={status} onChange={(e) => setStatus(e.target.value as ProductInput["status"])}>
                  <option value="publish">Published (in the shop)</option>
                  <option value="draft">Draft (hidden)</option>
                  <option value="private">Private (hidden)</option>
                </select>
              </div>
              <div>
                <span className={label}>Published on</span>
                <input type="date" className={input} value={day(publishedAt)} onChange={(e) => setPublishedAt(fromDay(e.target.value))} />
              </div>
              <div>
                <span className={label}>Position in “popularity” order</span>
                <input className={input} inputMode="numeric" value={menuOrder} onChange={(e) => setMenuOrder(Number(e.target.value.replace(/[^\d-]/g, "")) || 0)} />
                <p className="mt-1 text-[12px] text-[#646970]">Lower comes first.</p>
              </div>
              <button type="button" disabled={busy} onClick={save} className="rounded bg-[#2271b1] px-3 py-1.5 text-[13px] text-white hover:bg-[#135e96] disabled:opacity-60">
                {busy ? "Saving…" : initial ? "Update" : "Create product"}
              </button>
            </div>
          </section>

          <section className={box}>
            <div className={boxTitle}>Categories</div>
            <div className="max-h-[320px] overflow-y-auto p-3">
              {ordered.map((c) => (
                <label key={c.slug} className="flex items-center gap-1.5 py-0.5 text-[13px]" style={{ paddingLeft: c.depth * 16 }}>
                  <input type="checkbox" checked={categorySlugs.includes(c.slug)} onChange={(e) => setCategorySlugs(e.target.checked ? [...categorySlugs, c.slug] : categorySlugs.filter((s) => s !== c.slug))} />
                  {c.name}
                </label>
              ))}
            </div>
          </section>

          {initial ? (
            <section className={box}>
              <div className={boxTitle}>Remove from the shop</div>
              <div className="grid gap-2 p-3 text-[13px]">
                {archived ? (
                  <>
                    <button type="button" disabled={busy} className="rounded border border-[#2271b1] px-3 py-1 text-[#2271b1]" onClick={() => run(() => restoreProductAction(initial.shopId), "Product restored.")}>
                      Restore product
                    </button>
                    {initial.ordered ? (
                      <p className="text-[12px] text-[#646970]">This product was ordered before, so it can&apos;t be deleted: it stays archived (hidden) and the orders keep showing it.</p>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-[#d63638] px-3 py-1 text-[#d63638]"
                        onClick={() => {
                          if (window.confirm(`Delete “${initial.name}” for good? Its prices, stock, variations and its Sanity texts and pictures are removed. This can't be undone.`)) {
                            run(() => deleteProductAction(initial.shopId), "Product deleted.", () => router.push("/admin/products/?status=archived"));
                          }
                        }}
                      >
                        Delete permanently
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-[#d63638] px-3 py-1 text-[#d63638]"
                      onClick={() => {
                        if (window.confirm(`Archive “${initial.name}”? It disappears from the shop at once; you can restore it later.`)) run(() => archiveProductAction(initial.shopId), "Product archived.");
                      }}
                    >
                      Archive (remove from the shop)
                    </button>
                    <p className="text-[12px] text-[#646970]">Archived products can be restored, or deleted for good if they were never ordered.</p>
                  </>
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
