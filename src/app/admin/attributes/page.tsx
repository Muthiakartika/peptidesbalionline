/**
 * /admin/attributes/: the shop-wide attributes (WooCommerce → Products → Attributes): MG, Pen Type, IU,
 * Storage…, their display (pills or a dropdown), values in order and how many products use them.
 */
import Link from "next/link";
import { Suspense } from "react";

import { listAdminAttributes } from "@/lib/commerce/taxonomy-admin";

import { staffOnly } from "../orders/guard";

async function AttributesList() {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const attributes = await listAdminAttributes();
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-normal">Attributes</h1>
        <Link href="/admin/attributes/new/" className="rounded border border-[#2271b1] px-2.5 py-1 text-[13px] text-[#2271b1] hover:bg-[#2271b1] hover:text-white">
          Add new attribute
        </Link>
      </div>
      {attributes.length === 0 ? (
        <p className="mb-3 border-l-4 border-[#dba617] bg-white px-3 py-2 text-[13px]">
          The attributes aren&apos;t in the store database yet: run <code>node scripts/import/import-catalog.mjs</code> once.
        </p>
      ) : null}
      <div className="overflow-x-auto border border-[#c3c4c7] bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-[#c3c4c7]">
            <tr>
              {["Name", "Shown as", "Values", "Products"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributes.map((a, i) => (
              <tr key={a.slug} className={i % 2 ? "" : "bg-[#f6f7f7]"}>
                <td className="px-3 py-2">
                  <Link href={`/admin/attributes/${a.slug}/`} className="font-semibold text-[#2271b1]">
                    {a.label}
                  </Link>
                  <div className="text-[12px] text-[#646970]">pa_{a.slug}</div>
                </td>
                <td className="px-3 py-2">{a.swatches ? "Pills" : "Dropdown"}</td>
                <td className="px-3 py-2 text-[13px] text-[#646970]">{a.terms.map((t) => t.label).join(", ")}</td>
                <td className="px-3 py-2">{a.products}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-[#646970]">
        A product uses an attribute in its own screen (Products → a product → Attributes → choose it, tick the values). Renaming a value or changing the order shows on every product at once.
      </p>
    </>
  );
}

export default function AttributesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AttributesList />
    </Suspense>
  );
}
