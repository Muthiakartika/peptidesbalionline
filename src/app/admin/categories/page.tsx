/**
 * /admin/categories/: every product category (WooCommerce → Products → Categories) as a tree, with
 * its address, how many products the shop lists in it (sub-categories included) and its carousel
 * position. "Add new" makes one; a name opens it.
 */
import Link from "next/link";
import { Suspense } from "react";

import { listAdminCategories } from "@/lib/commerce/taxonomy-admin";

import { staffOnly } from "../orders/guard";

async function CategoriesList() {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const categories = await listAdminCategories();
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-normal">Categories</h1>
        <Link href="/admin/categories/new/" className="rounded border border-[#2271b1] px-2.5 py-1 text-[13px] text-[#2271b1] hover:bg-[#2271b1] hover:text-white">
          Add new category
        </Link>
      </div>
      {categories.length === 0 ? (
        <p className="mb-3 border-l-4 border-[#dba617] bg-white px-3 py-2 text-[13px]">
          The categories aren&apos;t in the store database yet: run <code>node scripts/import/import-catalog.mjs</code> once. Until then the shop shows the live site&apos;s categories.
        </p>
      ) : null}
      <div className="overflow-x-auto border border-[#c3c4c7] bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-[#c3c4c7]">
            <tr>
              {["Name", "Address", "Products", "Position"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c.id} className={i % 2 ? "" : "bg-[#f6f7f7]"}>
                <td className="px-3 py-2">
                  <span style={{ paddingLeft: c.depth * 18 }} className="inline-block">
                    {c.depth ? <span className="mr-1 text-[#a7aaad]">—</span> : null}
                    <Link href={`/admin/categories/${c.id}/`} className="font-semibold text-[#2271b1]">
                      {c.name}
                    </Link>
                  </span>
                </td>
                <td className="px-3 py-2 text-[13px]">
                  <a href={c.path} target="_blank" rel="noreferrer" className="text-[#2271b1]">
                    {c.path}
                  </a>
                </td>
                <td className="px-3 py-2">{c.listed}</td>
                <td className="px-3 py-2 text-[#646970]">{c.sortOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-[#646970]">
        Products: how many the shop lists in the category (published ones, sub-categories included). Position: the order of the round pictures above the products (lower first; top-level
        categories on /shop/). Products are put in categories in their own screen (Products → a product → Categories).
      </p>
    </>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CategoriesList />
    </Suspense>
  );
}
