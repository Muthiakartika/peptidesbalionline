/**
 * /admin/products/: every product (WooCommerce → Products), with the status filter (?status=draft), a
 * name search (?s=), price, stock and categories. "Add new" makes a product; a product's name opens it.
 * Texts and pictures are edited in Sanity (each product's screen links there).
 */
import Link from "next/link";
import { Suspense } from "react";

import { getCategories } from "@/lib/catalog";
import { listAdminProducts } from "@/lib/commerce/product-admin";

import { staffOnly } from "../orders/guard";

const STATUS_NAMES: Record<string, string> = { publish: "Published", draft: "Draft", private: "Private", archived: "Archived" };
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function ProductsList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const params = await searchParams;
  const status = typeof params.status === "string" && params.status in STATUS_NAMES ? params.status : null;
  const search = typeof params.s === "string" ? params.s.trim().toLowerCase() : "";
  const all = await listAdminProducts();
  const categoryNames = new Map((await getCategories()).map((c) => [c.slug, c.name]));
  const rows = all.filter((p) => (status ? p.status === status : p.status !== "archived") && (!search || p.name.toLowerCase().includes(search) || p.slug.includes(search)));
  const counts = Object.keys(STATUS_NAMES).map((s) => [s, all.filter((p) => p.status === s).length] as const);
  const link = (s: string | null) => `/admin/products/?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(search ? { s: search } : {}) }).toString()}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-normal">Products</h1>
        <Link href="/admin/products/new/" className="rounded border border-[#2271b1] px-2.5 py-1 text-[13px] text-[#2271b1] hover:bg-[#2271b1] hover:text-white">
          Add new product
        </Link>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-2 text-[13px] text-[#646970]">
          <li>
            <Link href={link(null)} className={status ? "text-[#2271b1]" : "font-semibold text-black"}>
              All ({all.filter((p) => p.status !== "archived").length})
            </Link>
          </li>
          {counts.map(([s, n]) =>
            n ? (
              <li key={s}>
                |{" "}
                <Link href={link(s)} className={status === s ? "font-semibold text-black" : "text-[#2271b1]"}>
                  {STATUS_NAMES[s]} ({n})
                </Link>
              </li>
            ) : null,
          )}
        </ul>
        <form className="flex gap-1" action="/admin/products/">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input name="s" defaultValue={search} placeholder="Search products" className="rounded border border-[#8c8f94] px-2 py-1 text-[13px]" />
          <button className="rounded border border-[#2271b1] px-2.5 py-1 text-[13px] text-[#2271b1]">Search</button>
        </form>
      </div>
      <div className="overflow-x-auto border border-[#c3c4c7] bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-[#c3c4c7]">
            <tr>
              {["Name", "Stock", "Price", "Categories", "Status"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((p, i) => (
                <tr key={p.shopId} className={i % 2 ? "" : "bg-[#f6f7f7]"}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/products/${p.shopId}/`} className="font-semibold text-[#2271b1]">
                      {p.name}
                    </Link>
                    <div className="text-[12px] text-[#646970]">
                      #{p.shopId} · {p.type === "variable" ? `${p.variants} variations` : "Simple"}
                      {p.status === "publish" ? (
                        <>
                          {" · "}
                          <a href={`/product/${p.slug}/`} className="text-[#2271b1]" target="_blank" rel="noreferrer">
                            View
                          </a>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className={`px-3 py-2 ${p.stock.startsWith("Out") ? "text-[#b32d2e]" : p.stock.startsWith("On") ? "text-[#996800]" : "text-[#007017]"}`}>{p.stock}</td>
                  <td className="px-3 py-2">
                    {p.priceMin === null ? "–" : p.priceMin === p.priceMax ? rupiah(p.priceMin) : `${rupiah(p.priceMin)} – ${rupiah(p.priceMax!)}`}
                    {p.onSale ? <span className="ml-1 rounded bg-[#fcf0f1] px-1 text-[11px] text-[#b32d2e]">sale</span> : null}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-[#646970]">{p.categorySlugs.map((s) => categoryNames.get(s) ?? s).join(", ")}</td>
                  <td className="px-3 py-2">{STATUS_NAMES[p.status] ?? p.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#646970]">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-[#646970]">
        Prices, stock, variations, categories and status are edited here. Descriptions and pictures: Sanity Studio (<Link href="/studio/" className="text-[#2271b1]">/studio/</Link> → Products).
      </p>
    </>
  );
}

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ProductsList searchParams={searchParams} />
    </Suspense>
  );
}
