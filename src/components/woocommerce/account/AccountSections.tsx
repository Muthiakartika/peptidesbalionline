/**
 * What My Account shows on the right for each endpoint (server components), with WooCommerce 11.2.1's
 * templates and texts (myaccount/dashboard.php, orders.php, downloads, my-address.php, view-order.php,
 * order/order-details.php) and the owner's "Research tools" tab:
 *   (the Dashboard is AccountDashboard.tsx)
 *   Orders         the customer's orders (10 a page), or "No order has been made yet.", after the
 *                  "Confirm email address" note WooCommerce 11 shows to accounts whose e-mail isn't confirmed;
 *   View order     one of the customer's orders, or "Invalid order.";
 *   Downloads      "No downloads available yet." (the shop sells no downloadable products);
 *   Addresses      the billing and shipping address, or "You have not set up this type of address yet.";
 *   Payment methods "No saved methods found." (no payment method saves cards);
 *   Research tools the plugin's teaser: the tools come with the first paid order (Protocol Builder, Phase 6c).
 */
import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { addresses, orderNotes, orders } from "@/db/schema";
import { longDate } from "@/lib/blog/dates";
import type { AccountUser } from "@/lib/account/session";
import { formatAddress, type AddressType } from "@/lib/account/validation";
import { CartAmount } from "@/components/woocommerce/cart/CartPrice";

import { cancelAddress, cancelToken, getOrderWithLines, needsPayment, ORDER_STATUS_NAMES, paymentAddress } from "@/lib/commerce/orders";

import { OrderDetails } from "../order/OrderDetails";

import { ClaimForm } from "./ClaimForm";

/** WordPress's "Blog pages show at most" (posts_per_page), which WooCommerce uses for the orders list. */
export const ORDERS_PER_PAGE = 10;

const STATUS_NAMES = ORDER_STATUS_NAMES;

const isoDate = (date: Date) => date.toISOString().slice(0, 19);

function BrowseProducts({ text }: { text: string }) {
  return (
    <div className="woocommerce-info" role="status">
      {text}{" "}
      <Link className="woocommerce-Button wc-forward button" href="/shop/">
        Browse products
      </Link>
    </div>
  );
}

export async function Orders({ user, page, sendVerification }: { user: AccountUser; page: number; sendVerification: boolean }) {
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(orders).where(eq(orders.userId, user.id));
  const rows = total
    ? await db
        .select({
          id: orders.id,
          number: orders.orderNumber,
          key: orders.orderKey,
          status: orders.status,
          created: orders.createdAt,
          totalMinor: orders.totalMinor,
          // Written out in full: inside a sub-select drizzle prints column names without their table.
          items: sql<string>`coalesce((select sum(oi.quantity) from order_items oi where oi.order_id = "orders"."id"), 0)`,
        })
        .from(orders)
        .where(eq(orders.userId, user.id))
        .orderBy(desc(orders.createdAt))
        .limit(ORDERS_PER_PAGE)
        .offset((page - 1) * ORDERS_PER_PAGE)
    : [];
  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  return (
    <>
      {sendVerification ? (
        <ul className="woocommerce-error" role="alert">
          <li>This copy of the shop can&apos;t send e-mails yet, so the confirmation link wasn&apos;t sent.</li>
        </ul>
      ) : null}
      {!user.emailVerified ? (
        <div className="woocommerce-info" role="status">
          <Link href="/my-account/orders/?wc_send_verification=1" className="button wc-forward">
            Confirm email address
          </Link>{" "}
          Confirm your email address to check for past orders and link them to your account.
        </div>
      ) : null}
      {rows.length ? (
        <>
          <table className="woocommerce-orders-table woocommerce-MyAccount-orders shop_table shop_table_responsive my_account_orders account-orders-table">
            <thead>
              <tr>
                {[
                  ["order-number", "Order"],
                  ["order-date", "Date"],
                  ["order-status", "Status"],
                  ["order-total", "Total"],
                  ["order-actions", "Actions"],
                ].map(([id, name]) => (
                  <th key={id} scope="col" className={`woocommerce-orders-table__header woocommerce-orders-table__header-${id}`}>
                    <span className="nobr">{name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => {
                const number = order.number.toString();
                const items = Number(order.items);
                return (
                  <tr key={order.id} className={`woocommerce-orders-table__row woocommerce-orders-table__row--status-${order.status} order`}>
                    <th className="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-number" data-title="Order" scope="row">
                      <Link href={`/my-account/view-order/${number}/`} aria-label={`View order number ${number}`}>
                        #{number}
                      </Link>
                    </th>
                    <td className="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-date" data-title="Date">
                      <time dateTime={order.created.toISOString()}>{longDate(isoDate(order.created))}</time>
                    </td>
                    <td className="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-status" data-title="Status">
                      {STATUS_NAMES[order.status] ?? order.status}
                    </td>
                    <td className="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-total" data-title="Total">
                      <CartAmount value={order.totalMinor} /> for {items} {items === 1 ? "item" : "items"}
                    </td>
                    <td className="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-actions" data-title="Actions">
                      {/* wc_get_account_orders_actions: Pay and Cancel while the order still needs paying, and View. */}
                      {needsPayment(order.status) ? (
                        <a href={paymentAddress(number, order.key)} className="woocommerce-button button pay" aria-label={`Pay for order ${number}`}>
                          Pay
                        </a>
                      ) : null}
                      <Link href={`/my-account/view-order/${number}/`} className="woocommerce-button button view" aria-label={`View order ${number}`}>
                        View
                      </Link>
                      {needsPayment(order.status) ? (
                        <a href={cancelAddress(number, order.key, cancelToken(order.key, user.sessionToken))} className="woocommerce-button button cancel" aria-label={`Cancel order ${number}`}>
                          Cancel
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pages > 1 ? (
            <div className="woocommerce-pagination woocommerce-pagination--without-numbers woocommerce-Pagination">
              {page !== 1 ? (
                <Link className="woocommerce-button woocommerce-button--previous woocommerce-Button woocommerce-Button--previous button" href={page - 1 === 1 ? "/my-account/orders/" : `/my-account/orders/${page - 1}/`}>
                  Previous
                </Link>
              ) : null}
              {page !== pages ? (
                <Link className="woocommerce-button woocommerce-button--next woocommerce-Button woocommerce-Button--next button" href={`/my-account/orders/${page + 1}/`}>
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <BrowseProducts text="No order has been made yet." />
      )}
    </>
  );
}

/** One of the customer's orders by its number (view-order.php + order details), or WooCommerce's "Invalid order." */
export async function ViewOrder({ user, number }: { user: AccountUser; number: string }) {
  const view = await getOrderWithLines(number, { userId: user.id });
  if (!view) {
    return (
      <ul className="woocommerce-error" role="alert">
        <li>
          Invalid order.{" "}
          <Link href="/my-account/" className="wc-forward">
            My account
          </Link>
        </li>
      </ul>
    );
  }
  const { order } = view;
  // get_customer_order_notes(): the notes marked "Note to customer", newest first.
  const notes = await getDb()
    .select({ id: orderNotes.id, body: orderNotes.body, createdAt: orderNotes.createdAt })
    .from(orderNotes)
    .where(and(eq(orderNotes.orderId, order.id), eq(orderNotes.isCustomerNote, true)))
    .orderBy(desc(orderNotes.createdAt));
  return (
    <>
      <p>
        Order #<mark className="order-number">{order.orderNumber.toString()}</mark> was placed on <mark className="order-date">{longDate(isoDate(order.createdAt))}</mark> and is currently{" "}
        <mark className="order-status">{STATUS_NAMES[order.status] ?? order.status}</mark>.
      </p>
      {notes.length ? (
        <>
          <h2>Order updates</h2>
          <ol className="woocommerce-OrderUpdates commentlist notes">
            {notes.map((note) => (
              <li key={note.id} className="woocommerce-OrderUpdate comment note">
                <div className="woocommerce-OrderUpdate-inner comment_container">
                  <div className="woocommerce-OrderUpdate-text comment-text">
                    <p className="woocommerce-OrderUpdate-meta meta">{noteDate(note.createdAt)}</p>
                    <div className="woocommerce-OrderUpdate-description description">
                      {note.body.split(/\n\s*\n/).map((paragraph, i) => (
                        <p key={i}>
                          {paragraph.split("\n").map((line, j) => (
                            <span key={j}>
                              {j ? <br /> : null}
                              {line}
                            </span>
                          ))}
                        </p>
                      ))}
                    </div>
                    <div className="clear" />
                  </div>
                  <div className="clear" />
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <OrderDetails view={view} />
    </>
  );
}

/** A note's date as view-order.php prints it ("l jS \o\f F Y, h:ia"): "Saturday 7th of November 2026, 02:36am" (site time = UTC). */
function noteDate(date: Date) {
  const day = date.getUTCDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(date);
  const hours = date.getUTCHours() % 12 || 12;
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${part({ weekday: "long" })} ${day}${suffix} of ${part({ month: "long" })} ${date.getUTCFullYear()}, ${String(hours).padStart(2, "0")}:${minutes}${date.getUTCHours() < 12 ? "am" : "pm"}`;
}

export function Downloads() {
  return (
    <div className="woocommerce-info" role="status">
      No downloads available yet.{" "}
      <Link className="button wc-forward" href="/shop/">
        Browse products
      </Link>
    </div>
  );
}

export function PaymentMethods() {
  return (
    <div className="woocommerce-info" role="status">
      No saved methods found.
    </div>
  );
}

export type SavedAddress = Record<string, string>;

/** The customer's saved billing and shipping address (empty fields as ""). */
export async function loadAddresses(userId: string): Promise<Record<AddressType, SavedAddress | null>> {
  const rows = await getDb().select().from(addresses).where(eq(addresses.userId, userId));
  const result: Record<AddressType, SavedAddress | null> = { billing: null, shipping: null };
  for (const row of rows) {
    result[row.type] = {
      first_name: row.firstName ?? "",
      last_name: row.lastName ?? "",
      company: row.company ?? "",
      address_1: row.address1 ?? "",
      address_2: row.address2 ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      postcode: row.postcode ?? "",
      country: row.country ?? "",
      phone: row.phone ?? "",
      phone_country_code: row.phoneCountryCode ?? "",
      email: row.email ?? "",
    };
  }
  return result;
}

export async function Addresses({ user }: { user: AccountUser }) {
  const saved = await loadAddresses(user.id);
  const titles: [AddressType, string][] = [
    ["billing", "Billing address"],
    ["shipping", "Shipping address"],
  ];
  return (
    <>
      <p>The following addresses will be used on the checkout page by default.</p>
      <div className="u-columns woocommerce-Addresses col2-set addresses">
        {titles.map(([type, title], index) => {
          const lines = saved[type] ? formatAddress(saved[type]) : [];
          return (
            <div key={type} className={`u-column${index + 1} col-${index + 1} woocommerce-Address`}>
              <header className="woocommerce-Address-title title">
                <h2>{title}</h2>
                <Link href={`/my-account/edit-address/${type}/`} className="edit">
                  {lines.length ? `Edit ${title}` : `Add ${title}`}
                </Link>
              </header>
              <address>
                {lines.length
                  ? lines.map((line, i) => (
                      <span key={i}>
                        {i > 0 ? <br /> : null}
                        {line}
                      </span>
                    ))
                  : "You have not set up this type of address yet."}
              </address>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The owner's "Research tools" tab (Atlas Research Planner plugin) for an account without a paid order. */
export function ResearchTools() {
  return (
    <>
      {/* The plugin's own stylesheet, linked where the plugin links it (inside the tab). */}
      {/* eslint-disable-next-line @next/next/no-css-tags -- the owner's plugin CSS, as on live */}
      <link rel="stylesheet" id="arp-tools-style-inline-css" href="/legacy/vendor/atlas-research-planner/tools.css" media="all" precedence="default" />
      <div
        className="arpt arpt-teaser"
        data-arp-tools=""
        data-arp-teaser="no_paid_order"
        style={{ "--arpt-primary": "#b8952a", "--arpt-primary-strong": "#8a6d16", "--arpt-accent": "#242424", "--arpt-primary-soft": "#f5f0e1", "--arpt-primary-on-soft": "#826615" } as React.CSSProperties}
      >
        <div className="arpt-empty arpt-empty--hero arpt-teaser__card">
          <div className="arpt-empty__art" aria-hidden="true">
            <svg className="arpt-ico arpt-ico--xl" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 3h6M10 3v4M14 3v4M8.5 7h7v12a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2zM8.5 13h7" />
            </svg>
          </div>
          <h2 className="arpt-title arpt-teaser__title">Research tools</h2>
          <p className="arpt-empty__text arpt-teaser__lead">Your research tools unlock with your first paid order.</p>
          <p className="arpt-empty__actions arpt-teaser__actions">
            <Link className="arpt-btn arpt-btn--xl arpt-btn--primary" href="/protocol-builder/" data-arp-teaser-link="planner">
              Plan your protocol
            </Link>
          </p>
        </div>
        <section className="arpt-card arpt-claim" aria-labelledby="arpt-claim-title" data-arp-claim-box="">
          <h3 className="arpt-card__title" id="arpt-claim-title">
            Ordered without an account before?
          </h3>
          <p>Earlier orders placed with your account email address can be linked to your account. We first send a confirmation link to that address.</p>
          <ClaimForm />
        </section>
      </div>
    </>
  );
}
