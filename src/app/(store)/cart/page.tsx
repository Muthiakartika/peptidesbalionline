/**
 * /cart/: the visitor's cart (Phase 5), as on the live site: the checkout steps in the band, then the
 * cart table, "Top up your supplies" and the cart totals, or WooCommerce's empty-cart page. The band is
 * built in advance; the cart itself comes from the visitor's cart cookie, so it is rendered for each
 * request inside <Suspense> (Cache Components). /checkout/ sends an empty cart here (src/proxy.ts).
 */
// As on every live page: AffiliateWP's form styles (also ".screen-reader-text"), Elementor core and
// kit, then the theme (imported by WooPage), then the cart's theme rules and the owner's CSS.
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
// The theme next (WooPage imports these too, but only after this page's own CSS, which would put the
// owner's rules before the theme's: live prints the theme first, so the owner's rules win ties).
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";
import "@/styles/woocommerce.css";
import "@/styles/cart.css";
import "@/styles/cart-owner.css";
import "@/styles/backorder-owner.css";
import "@/styles/usd-prices-owner.css";

import { Suspense } from "react";

import { CartContents } from "@/components/woocommerce/cart/CartContents";
import { CartNoticesProvider } from "@/components/woocommerce/cart/CartControls";
import { CheckoutSteps } from "@/components/woocommerce/CheckoutSteps";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { WooPage } from "@/components/woocommerce/WooPage";

export const metadata = wooMetadata("Cart", "/cart/");

export default function CartPage() {
  return (
    <WooPage jsonLdPath="/cart/" pageId={10} pageClass="woocommerce-cart" band={<CheckoutSteps current="cart" />}>
      <CartNoticesProvider>
        <Suspense fallback={null}>
          <CartContents />
        </Suspense>
      </CartNoticesProvider>
    </WooPage>
  );
}
