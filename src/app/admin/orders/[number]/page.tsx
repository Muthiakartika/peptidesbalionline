/**
 * /admin/orders/<number>/: one order for the staff (WooCommerce's order screen): the customer's billing and
 * shipping details, the owner's extra fields (delivery day and time slot as snippet 6140 shows them,
 * "Delivery Location" with the coordinates and a Google Maps link as snippet 6865 does), the lines and
 * totals, the customer's note, the status (with the change noted) and the order notes.
 */
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Suspense, type ReactNode } from "react";

import { CartAmount } from "@/components/woocommerce/cart/CartPrice";
import { getDb } from "@/db";
import { orderFees, orderItems, orderNotes, orders } from "@/db/schema";
import { formatAddress } from "@/lib/account/validation";
import { ORDER_STATUS_NAMES } from "@/lib/commerce/orders";

import { addOrderNoteAction, updateOrderStatus } from "../actions";
import { staffOnly } from "../guard";
import { StatusBadge } from "../StatusBadge";

export function generateStaticParams() {
  return [{ number: "1" }];
}

type Address = { firstName?: string; lastName?: string; address1?: string; city?: string; state?: string; postcode?: string; country?: string; phone?: string; email?: string };
const lines = (a: Address | null) =>
  a ? formatAddress({ first_name: a.firstName ?? "", last_name: a.lastName ?? "", address_1: a.address1 ?? "", city: a.city ?? "", state: a.state ?? "", postcode: a.postcode ?? "", country: a.country ?? "" }) : [];

/** The owner's snippet: wp_date("l, j F Y") of the delivery day, e.g. "Saturday, 7 November 2026". */
function deliveryDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? "";
  const date = new Date(`${value}T12:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(date);
  return `${part({ weekday: "long" })}, ${Number(value.slice(8))} ${part({ month: "long" })} ${value.slice(0, 4)}`;
}

const Box = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-4 border border-[#c3c4c7] bg-white">
    <h2 className="border-b border-[#c3c4c7] px-3 py-2 text-[14px] font-semibold">{title}</h2>
    <div className="p-3">{children}</div>
  </section>
);

async function OrderScreen({ params }: { params: Promise<{ number: string }> }) {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const { number } = await params;
  const db = getDb();
  const [order] = /^\d{1,18}$/.test(number) ? await db.select().from(orders).where(eq(orders.orderNumber, BigInt(number))).limit(1) : [];
  if (!order) return <p>This order doesn&apos;t exist.</p>;
  const [items, fees, notes] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderFees).where(eq(orderFees.orderId, order.id)),
    db.select().from(orderNotes).where(eq(orderNotes.orderId, order.id)).orderBy(asc(orderNotes.createdAt)),
  ]);
  const billing = order.billing as Address;
  const shipping = order.shipping as Address | null;
  const location = order.deliveryLocation as { address?: string; lat?: string; lng?: string } | null;
  const created = order.createdAt;

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/admin/orders/" className="text-[#2271b1]">
          ← Orders
        </Link>
      </p>
      <h1 className="mb-1 text-[23px] font-normal">Order #{order.orderNumber.toString()} details</h1>
      <p className="mb-4 text-[#646970]">
        Payment via {order.paymentMethodTitle}. Placed on {created.toISOString().slice(0, 10)} {created.toISOString().slice(11, 16)} (UTC). <StatusBadge status={order.status} />
      </p>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Box title="Billing">
              {lines(billing).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              {billing.email ? (
                <p className="mt-2">
                  <strong>Email address:</strong>{" "}
                  <a href={`mailto:${billing.email}`} className="text-[#2271b1]">
                    {billing.email}
                  </a>
                </p>
              ) : null}
              {billing.phone ? (
                <p>
                  <strong>Phone:</strong>{" "}
                  <a href={`tel:${billing.phone}`} className="text-[#2271b1]">
                    {billing.phone}
                  </a>
                </p>
              ) : null}
              {location?.address || (location?.lat && location?.lng) ? (
                <div className="mt-3">
                  <h3 className="font-semibold">Delivery Location</h3>
                  {location.address ? (
                    <p>
                      <strong>Full delivery address:</strong>
                      <br />
                      {location.address}
                    </p>
                  ) : null}
                  {location.lat && location.lng ? (
                    <>
                      <p>
                        <strong>Coordinates:</strong>
                        <br />
                        {location.lat}, {location.lng}
                      </p>
                      <p>
                        <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${location.lat},${location.lng}`)}`} target="_blank" rel="noopener" className="text-[#2271b1]">
                          Open delivery location in Google Maps
                        </a>
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </Box>
            <Box title="Shipping">
              {lines(shipping).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              {shipping?.phone ? <p className="mt-2">{shipping.phone}</p> : null}
              {order.deliveryDay || order.deliveryTimeSlot ? (
                <div className="order-delivery-details mt-3">
                  <h3 className="font-semibold">Delivery details</h3>
                  {order.deliveryDay ? (
                    <p>
                      <strong>Delivery day:</strong> {deliveryDay(order.deliveryDay)}
                    </p>
                  ) : null}
                  {order.deliveryTimeSlot ? (
                    <p>
                      <strong>Time slot:</strong> {order.deliveryTimeSlot.replace("-", "–")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {order.customerNote ? (
                <p className="mt-3">
                  <strong>Customer provided note:</strong>
                  <br />
                  {order.customerNote}
                </p>
              ) : null}
            </Box>
          </div>
          <Box title="Items">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#dcdcde]">
                  <th className="py-1">Item</th>
                  <th className="py-1">Cost</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[#f0f0f1] align-top">
                    <td className="py-2">
                      {item.productName}
                      {item.options?.length ? <div className="text-[12px] text-[#646970]">{item.options.map((o) => `${o.label}: ${o.value}`).join(" · ")}</div> : null}
                    </td>
                    <td className="py-2">
                      <CartAmount value={item.unitPriceMinor} />
                    </td>
                    <td className="py-2">× {item.quantity}</td>
                    <td className="py-2 text-right">
                      <CartAmount value={item.lineTotalMinor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto mt-3 grid max-w-[320px] grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <dt>Items Subtotal:</dt>
              <dd className="text-right">
                <CartAmount value={order.subtotalMinor} />
              </dd>
              {order.discountMinor > 0n ? (
                <>
                  <dt>Coupon(s):</dt>
                  <dd className="text-right">
                    -<CartAmount value={order.discountMinor} />
                  </dd>
                </>
              ) : null}
              {fees.map((fee) => (
                <span key={fee.id} className="contents">
                  <dt>{fee.label}:</dt>
                  <dd className="text-right">
                    <CartAmount value={fee.amountMinor} />
                  </dd>
                </span>
              ))}
              <dt>Shipping:</dt>
              <dd className="text-right">{order.shippingMinor > 0n ? <CartAmount value={order.shippingMinor} /> : (order.shippingMethodTitle ?? "—")}</dd>
              <dt className="font-semibold">Order Total:</dt>
              <dd className="text-right font-semibold">
                <CartAmount value={order.totalMinor} />
              </dd>
            </dl>
          </Box>
        </div>
        <div>
          <Box title="Status">
            <form action={updateOrderStatus.bind(null, order.id)} className="flex gap-2">
              <select name="order_status" defaultValue={order.status} className="flex-1 rounded border border-[#8c8f94] px-2 py-1">
                {Object.entries(ORDER_STATUS_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-[#2271b1] px-3 py-1 text-white">
                Update
              </button>
            </form>
          </Box>
          <Box title="Order notes">
            <ul className="mb-3 space-y-2">
              {notes.length ? (
                notes.map((note) => (
                  <li key={note.id} className={`rounded p-2 text-[13px] ${note.isCustomerNote ? "bg-[#a7cedc]" : "bg-[#efefef]"}`}>
                    <p>{note.body}</p>
                    <p className="mt-1 text-[11px] text-[#646970]">
                      {note.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC{note.isCustomerNote ? " · Note to customer" : ""}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-[#646970]">There are no notes yet.</li>
              )}
            </ul>
            <form action={addOrderNoteAction.bind(null, order.id)} className="space-y-2">
              <textarea name="order_note" rows={3} className="w-full rounded border border-[#8c8f94] p-2" aria-label="Add note" />
              <div className="flex gap-2">
                <select name="order_note_type" className="flex-1 rounded border border-[#8c8f94] px-2 py-1" aria-label="Note type">
                  <option value="private">Private note</option>
                  <option value="customer">Note to customer</option>
                </select>
                <button type="submit" className="rounded border border-[#2271b1] px-3 py-1 text-[#2271b1]">
                  Add
                </button>
              </div>
            </form>
          </Box>
        </div>
      </div>
    </>
  );
}

export default function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <OrderScreen params={params} />
    </Suspense>
  );
}
