/**
 * The title band of the cart and checkout pages: Woodmart's checkout steps, "Shopping cart >
 * Checkout > Order complete", with the current step underlined (on phones only the current step
 * shows). Styles: src/styles/woocommerce.css and the title band in src/styles/blog.css.
 */
import Link from "next/link";

export type CheckoutStep = "cart" | "checkout" | "complete";

const state = (step: CheckoutStep, current: CheckoutStep) => (step === current ? "step-active" : "step-inactive");

export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  return (
    <div className="wd-page-title page-title page-title-default title-size-default title-design-centered color-scheme-light">
      <div className="wd-page-title-bg wd-fill" />
      <div className="container">
        <ul className="wd-checkout-steps">
          <li className={`step-cart ${state("cart", current)}`}>
            <Link href="/cart/">
              <span>Shopping cart</span>
            </Link>
          </li>
          <li className={`step-checkout ${state("checkout", current)}`}>
            <Link href="/checkout/">
              <span>Checkout</span>
            </Link>
          </li>
          <li className={`step-complete ${state("complete", current)}`}>
            <span>Order complete</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
