/**
 * /admin/orders/: every order, newest first, 20 a page (WooCommerce → Orders), with the status filter
 * (?status=on-hold) and the columns WooCommerce shows: order, date, status, billing, ship to, total.
 */
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Suspense } from "react";

import { CartAmount } from "@/components/woocommerce/cart/CartPrice";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { longDate } from "@/lib/blog/dates";
import { ORDER_STATUS_NAMES } from "@/lib/commerce/orders";

import { staffOnly } from "./guard";
import { StatusBadge } from "./StatusBadge";

const PER_PAGE = 20;
type Address = { firstName?: string; lastName?: string; address1?: string; city?: string; phone?: string };
const name = (a: Address | null) => [a?.firstName, a?.lastName].filter(Boolean).join(" ");

async function OrdersList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const params = await searchParams;
  const status = typeof params.status === "string" && params.status in ORDER_STATUS_NAMES ? (params.status as keyof typeof ORDER_STATUS_NAMES) : null;
  const page = Math.max(1, Number.parseInt(String(params.paged ?? "1"), 10) || 1);
  const db = getDb();
  const where = status ? eq(orders.status, status as (typeof orders.$inferSelect)["status"]) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);
  const counts = await db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status);
  const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(PER_PAGE).offset((page - 1) * PER_PAGE);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const all = counts.reduce((sum, c) => sum + c.n, 0);
  const link = (s: string | null, p = 1) => `/admin/orders/?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(p > 1 ? { paged: String(p) } : {}) }).toString()}`;

  return (
    <>
      <h1 className="mb-3 text-[23px] font-normal">Orders</h1>
      <ul className="mb-3 flex flex-wrap gap-x-2 text-[13px] text-[#646970]">
        <li>
          <Link href={link(null)} className={status ? "text-[#2271b1]" : "font-semibold text-black"}>
            All ({all})
          </Link>
        </li>
        {counts.map((c) => (
          <li key={c.status}>
            |{" "}
            <Link href={link(c.status)} className={status === c.status ? "font-semibold text-black" : "text-[#2271b1]"}>
              {ORDER_STATUS_NAMES[c.status] ?? c.status} ({c.n})
            </Link>
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto border border-[#c3c4c7] bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-[#c3c4c7]">
            <tr>
              {["Order", "Date", "Status", "Billing", "Ship to", "Total"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((order, i) => {
                const billing = order.billing as Address;
                const shipping = order.shipping as Address | null;
                return (
                  <tr key={order.id} className={i % 2 ? "" : "bg-[#f6f7f7]"}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/orders/${order.orderNumber}/`} className="font-semibold text-[#2271b1]">
                        #{order.orderNumber.toString()} {name(billing)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-[#646970]">{longDate(order.createdAt.toISOString())}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-2 text-[#646970]">
                      {[billing.address1, billing.city].filter(Boolean).join(", ")}
                      <br />
                      <span className="text-[12px]">via {order.paymentMethodTitle}</span>
                    </td>
                    <td className="px-3 py-2 text-[#646970]">{[name(shipping), shipping?.address1, shipping?.city].filter(Boolean).join(", ")}</td>
                    <td className="px-3 py-2">
                      <CartAmount value={order.totalMinor} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#646970]">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <p className="mt-3 flex items-center gap-3 text-[13px]">
          {page > 1 ? <Link href={link(status, page - 1)}>‹ Previous</Link> : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={link(status, page + 1)}>Next ›</Link> : null}
        </p>
      ) : null}
    </>
  );
}

export default function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <OrdersList searchParams={searchParams} />
    </Suspense>
  );
}
