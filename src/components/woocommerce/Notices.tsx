/**
 * WooCommerce's one-line pages, with the live texts:
 *   * ResetLinkSent: /my-account/lost-password/?reset-link-sent=true, where WooCommerce sends the
 *     visitor after the lost-password form;
 *   * OrderReceived: /checkout/order-received/(<number>/), the "thank you" page after an order (the
 *     live site shows it for any order number, even without an order);
 *   * OrderInvalid: /checkout/order-pay/<number>/ for an order that cannot be paid.
 * The real order pages come with the checkout (Phase 5).
 */
import { NoticesWrapper } from "./NoticesWrapper";

export function ResetLinkSent() {
  return (
    <>
      <div className="woocommerce-message" role="alert">
        Password reset email has been sent.
      </div>
      <p>
        A password reset email has been sent to the email address on file for your account, but may take several minutes to show up in your inbox. Please wait at least 10 minutes before attempting another
        reset.
      </p>
    </>
  );
}

export function OrderReceived() {
  return (
    <div className="woocommerce-order">
      <p className="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">
        Thank you. Your order has been received. We will shortly be in touch with you to finalise your order.
      </p>
    </div>
  );
}

export function OrderInvalid() {
  return (
    <>
      <NoticesWrapper />
      <ul className="woocommerce-error" role="alert">
        <li>Sorry, this order is invalid and cannot be paid for.</li>
      </ul>
    </>
  );
}
