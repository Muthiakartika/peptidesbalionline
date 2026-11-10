/**
 * The cart page when the cart is empty (WooCommerce's message with Woodmart's empty-page design:
 * the big cart icon, the title, the text and "Return to shop"). Until the cart exists (Phase 5)
 * every visitor's cart is empty, as for a new visitor on the live site.
 */
import Link from "next/link";

import { NoticesWrapper } from "./NoticesWrapper";

/** `notices: false` when the cart page prints its own notices wrapper (with "… removed. Undo?"). */
export function EmptyCart({ notices = true }: { notices?: boolean }) {
  return (
    <>
      {notices ? <NoticesWrapper /> : null}
      <p className="cart-empty wd-empty-page wc-empty-cart-message">Your cart is currently empty.</p>
      <div className="wd-empty-page-text">
        Before proceed to checkout you must add some products to your shopping cart. You will find a lot of interesting products on our &quot;Shop&quot; page.
      </div>
      <p className="return-to-shop">
        <Link className="button wc-backward" href="/shop/">
          Return to shop
        </Link>
      </p>
    </>
  );
}
