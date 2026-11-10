/**
 * The thank-you page after "Place order" (/checkout/order-received/<number>/?key=…), WooCommerce 11.2.1's
 * checkout/thankyou.php with the owner's text (snippet 6152): the message, the order overview (number, date,
 * e-mail for the logged-in buyer, total, payment method), the payment method's instructions (Revolut, Wise,
 * COD: their "instructions" setting), then the order details and addresses (OrderDetails.tsx).
 * Without the order's key (or for a number that doesn't exist) only the message shows, as on live.
 */
import { CartAmount } from "@/components/woocommerce/cart/CartPrice";
import { longDate } from "@/lib/blog/dates";
import type { OrderView } from "@/lib/commerce/orders";
import { paymentMethods } from "@/lib/commerce/store-settings";

import { OrderDetails } from "./OrderDetails";

const RECEIVED = "Thank you. Your order has been received. We will shortly be in touch with you to finalise your order.";

export function ThankYou({ view, showEmail }: { view: OrderView | null; showEmail: boolean }) {
  if (!view) {
    return (
      <div className="woocommerce-order">
        <p className="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">{RECEIVED}</p>
      </div>
    );
  }
  const { order } = view;
  const instructions = paymentMethods.find((m) => m.id === order.paymentMethod)?.instructions;
  return (
    <div className="woocommerce-order">
      <p className="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">{RECEIVED}</p>
      <ul className="woocommerce-order-overview woocommerce-thankyou-order-details order_details">
        <li className="woocommerce-order-overview__order order">
          Order number: <strong>{order.orderNumber.toString()}</strong>
        </li>
        <li className="woocommerce-order-overview__date date">
          Date: <strong>{longDate(order.createdAt.toISOString())}</strong>
        </li>
        {showEmail && order.billingEmail ? (
          <li className="woocommerce-order-overview__email email">
            Email: <strong>{order.billingEmail}</strong>
          </li>
        ) : null}
        <li className="woocommerce-order-overview__total total">
          Total:{" "}
          <strong>
            <CartAmount value={order.totalMinor} />
          </strong>
        </li>
        <li className="woocommerce-order-overview__payment-method method">
          Payment method: <strong>{order.paymentMethodTitle}</strong>
        </li>
      </ul>
      {instructions ? <p>{instructions}</p> : null}
      <OrderDetails view={view} />
    </div>
  );
}
