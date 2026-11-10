/**
 * /checkout/order-pay/<number>/?pay_for_order=true&key=wc_order_…: paying for an order that still needs
 * payment (WooCommerce 11.2.1, WC_Shortcode_Checkout::order_pay with its texts), e.g. an IDR Account order
 * left "Pending payment":
 *   * a wrong key or no order: "Sorry, this order is invalid and cannot be paid for.";
 *   * a customer's order and nobody logged in: "Please log in to your account below…" with the login form;
 *   * someone else's order: "This order cannot be paid for. …";
 *   * a guest order while logged in with another e-mail: "You are paying for a guest order. …" (then the form);
 *   * an order that doesn't need payment: "This order’s status is “On hold”—it cannot be paid for. …";
 *   * else the order table, the payment methods and "Pay for order" (OrderPayForm.tsx).
 */
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";
import "@/styles/woocommerce.css";
import "@/styles/cart.css";
import "@/styles/checkout.css";
import "@/styles/checkout-owner.css";
import "@/styles/cart-owner.css";
import "@/styles/usd-prices-owner.css";

import { Fragment, Suspense, type ReactNode } from "react";

import { CheckoutSteps } from "@/components/woocommerce/CheckoutSteps";
import { NoticeList } from "@/components/woocommerce/account/AccountNotices";
import { CartAmount } from "@/components/woocommerce/cart/CartPrice";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { PayForm, PayLogin, type PayMethod } from "@/components/woocommerce/order/OrderPayForm";
import { WooPage } from "@/components/woocommerce/WooPage";
import { notice, type Notice } from "@/lib/account/notices";
import { getAccountUser } from "@/lib/account/session";
import { getOrderWithLines, needsPayment, ORDER_STATUS_NAMES, paymentAddress } from "@/lib/commerce/orders";
import { PAYMENT_DETAILS } from "@/lib/commerce/payment-details";
import { paymentMethods } from "@/lib/commerce/store-settings";

export const metadata = wooMetadata("Checkout", "/checkout/");

export function generateStaticParams() {
  return [{ number: "1" }];
}

type Props = { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const Messages = ({ list }: { list: Notice[] }) => (
  <div className="woocommerce-notices-wrapper">
    <NoticeList notices={list} />
  </div>
);

async function OrderPay({ params, searchParams }: Props) {
  const { number } = await params;
  const key = (await searchParams).key;
  const view = typeof key === "string" && key.startsWith("wc_order_") ? await getOrderWithLines(number, { key }).catch(() => null) : null;
  if (!view) return <Messages list={[notice.error("Sorry, this order is invalid and cannot be paid for.")]} />;
  const { order, items, fees } = view;
  const user = await getAccountUser().catch(() => null);
  if (order.userId && !user) return <PayLogin redirect={paymentAddress(order.orderNumber, order.orderKey)} />;
  if (order.userId && user?.id !== order.userId) return <Messages list={[notice.error("This order cannot be paid for. Please contact us if you need assistance.")]} />;
  if (!needsPayment(order.status)) {
    return <Messages list={[notice.error(`This order’s status is “${ORDER_STATUS_NAMES[order.status] ?? order.status}”—it cannot be paid for. Please contact us if you need assistance.`)]} />;
  }
  const guestWarning = !order.userId && user && user.email.toLowerCase() !== order.billingEmail.toLowerCase();

  const totals: [string, ReactNode][] = [["Subtotal:", <CartAmount key="s" value={order.subtotalMinor} />]];
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

  const table = (
    <table className="shop_table">
      <thead>
        <tr>
          <th className="product-name">Product</th>
          <th className="product-quantity">Qty</th>
          <th className="product-total">Totals</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="order_item">
            <td className="product-name">
              {item.productName}
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
            <td className="product-quantity">
              {" "}
              <strong className="product-quantity">×&nbsp;{item.quantity}</strong>
            </td>
            <td className="product-subtotal">
              <CartAmount value={item.lineSubtotalMinor} />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        {totals.map(([label, value]) => (
          <tr key={label}>
            <th scope="row" colSpan={2}>
              {label}
            </th>
            <td className="product-total">{value}</td>
          </tr>
        ))}
      </tfoot>
    </table>
  );
  const methods: PayMethod[] = paymentMethods.map((m) => ({ id: m.id, title: m.title, description: PAYMENT_DETAILS[m.id].description, logo: PAYMENT_DETAILS[m.id].logo }));
  return (
    <>
      {guestWarning ? <Messages list={[notice.error("You are paying for a guest order. Please continue with payment only if you recognize this order.")]} /> : null}
      <PayForm number={order.orderNumber.toString()} orderKey={order.orderKey} table={table} methods={methods} />
    </>
  );
}

export default function OrderPayPage(props: Props) {
  return (
    <WooPage jsonLdPath="/checkout/" pageId={11} pageClass="woocommerce-checkout woocommerce-order-pay" band={<CheckoutSteps current="checkout" />}>
      <Suspense fallback={null}>
        <OrderPay {...props} />
      </Suspense>
    </WooPage>
  );
}
