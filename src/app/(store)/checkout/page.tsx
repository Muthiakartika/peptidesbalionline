/**
 * /checkout/: the checkout (Phase 5), as on the live site: the checkout steps in the band, "Returning
 * customer?", the billing details with the owner's delivery location box, delivery slot and
 * instructions, then "Your order" with the coupon box, the payment methods and "Place order".
 * src/proxy.ts sends a visitor with an empty cart to /cart/ (302), as WooCommerce does. The band is
 * built in advance; the form comes from the visitor's cart cookie, so it is rendered for each request
 * inside <Suspense> (Cache Components).
 * Not live yet: the map (Q-33) and saving the order (the database); see CheckoutForm.tsx.
 */
// As on every live page: AffiliateWP's form styles, Elementor core and kit, then the theme, then the
// theme's cart and checkout rules, then the owner's CSS in WPCode's order (snippets 17–13, 11–10, 09).
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
import "@/styles/checkout.css";
import "@/styles/checkout-owner.css";
import "@/styles/cart-owner.css";
import "@/styles/usd-prices-owner.css";

import { Suspense } from "react";

import { CartNoticesProvider } from "@/components/woocommerce/cart/CartControls";
import { CheckoutContents } from "@/components/woocommerce/checkout/CheckoutContents";
import { CheckoutSteps } from "@/components/woocommerce/CheckoutSteps";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { WooPage } from "@/components/woocommerce/WooPage";

export const metadata = wooMetadata("Checkout", "/checkout/");

export default function CheckoutPage() {
  return (
    <WooPage jsonLdPath="/checkout/" pageId={11} pageClass="woocommerce-checkout" band={<CheckoutSteps current="checkout" />}>
      <CartNoticesProvider>
        <Suspense fallback={null}>
          <CheckoutContents />
        </Suspense>
      </CartNoticesProvider>
    </WooPage>
  );
}
