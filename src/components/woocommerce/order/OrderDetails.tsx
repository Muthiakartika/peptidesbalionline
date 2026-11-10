/**
 * One order as WooCommerce 11.2.1 prints it (server component): order/order-details.php with its lines
 * (order-details-item.php: name linked to the product, "× 2", the options as wc-item-meta), the totals
 * (get_order_item_totals: Subtotal, Discount, Shipping "via …", the card fee line, Payment method, Total),
 * the customer's note, then order/order-details-customer.php (billing and shipping address, phone,
 * e-mail). Used by the thank-you page and by My Account → View order.
 * The live theme may restyle these pages; no live order page could be captured (placing an order on the
 * live shop isn't allowed), so the markup is WooCommerce's own.
 */
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { CartAmount } from "@/components/woocommerce/cart/CartPrice";
import { formatAddress } from "@/lib/account/validation";
import type { OrderView } from "@/lib/commerce/orders";

type Address = { firstName?: string; lastName?: string; address1?: string; city?: string; state?: string; postcode?: string; country?: string; phone?: string; email?: string };

const addressLines = (address: Address | null) =>
  address
    ? formatAddress({
        first_name: address.firstName ?? "",
        last_name: address.lastName ?? "",
        address_1: address.address1 ?? "",
        city: address.city ?? "",
        state: address.state ?? "",
        postcode: address.postcode ?? "",
        country: address.country ?? "",
      })
    : [];

function Lines({ lines }: { lines: string[] }) {
  if (!lines.length) return <>N/A</>;
  return (
    <>
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  );
}

export function OrderDetails({ view }: { view: NonNullable<OrderView> }) {
  const { order, items, fees } = view;
  const totals: [string, ReactNode][] = [["Subtotal:", <CartAmount key="s" value={order.subtotalMinor} />]];
  // get_order_item_totals: '-' . wc_price( discount ) (the minus outside the price; a negative fee gets wc_price's own).
  if (order.discountMinor > 0n) totals.push(["Discount:", <Fragment key="d">-<CartAmount value={order.discountMinor} /></Fragment>]);
  totals.push([
    "Shipping:",
    order.shippingMinor > 0n ? (
      <>
        <CartAmount value={order.shippingMinor} />
        &nbsp;<small className="shipped_via">via {order.shippingMethodTitle}</small>
      </>
    ) : (
      (order.shippingMethodTitle ?? "Free shipping")
    ),
  ]);
  for (const fee of fees) totals.push([`${fee.label}:`, <CartAmount key={fee.id} value={fee.amountMinor} />]);
  totals.push(["Payment method:", order.paymentMethodTitle]);
  totals.push(["Total:", <CartAmount key="t" value={order.totalMinor} />]);
  const billing = order.billing as Address;
  const shipping = order.shipping as Address | null;

  return (
    <>
      <section className="woocommerce-order-details">
        <h2 className="woocommerce-order-details__title">Order details</h2>
        <table className="woocommerce-table woocommerce-table--order-details shop_table order_details">
          <thead>
            <tr>
              <th className="woocommerce-table__product-name product-name">Product</th>
              <th className="woocommerce-table__product-table product-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="woocommerce-table__line-item order_item">
                <td className="woocommerce-table__product-name product-name">
                  {item.productPath ? <Link href={item.productPath}>{item.productName}</Link> : item.productName} <strong className="product-quantity">×&nbsp;{item.quantity}</strong>
                  {item.options?.length ? (
                    <ul className="wc-item-meta">
                      {item.options.map((option) => (
                        <li key={option.label}>
                          <strong className="wc-item-meta-label">{option.label}:</strong> <p>{option.value}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="woocommerce-table__product-total product-total">
                  <CartAmount value={item.lineSubtotalMinor} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {totals.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
            {order.customerNote ? (
              <tr>
                <th>Note:</th>
                <td>{order.customerNote}</td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </section>
      <section className="woocommerce-customer-details">
        <section className="woocommerce-columns woocommerce-columns--2 woocommerce-columns--addresses col2-set addresses">
          <div className="woocommerce-column woocommerce-column--1 woocommerce-column--billing-address col-1">
            <h2 className="woocommerce-column__title">Billing address</h2>
            <address>
              <Lines lines={addressLines(billing)} />
              {billing.phone ? <p className="woocommerce-customer-details--phone">{billing.phone}</p> : null}
              {billing.email ? <p className="woocommerce-customer-details--email">{billing.email}</p> : null}
            </address>
          </div>
          <div className="woocommerce-column woocommerce-column--2 woocommerce-column--shipping-address col-2">
            <h2 className="woocommerce-column__title">Shipping address</h2>
            <address>
              <Lines lines={addressLines(shipping)} />
              {shipping?.phone ? <p className="woocommerce-customer-details--phone">{shipping.phone}</p> : null}
            </address>
          </div>
        </section>
      </section>
    </>
  );
}
