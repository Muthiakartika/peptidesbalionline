/**
 * /checkout/order-received/ and /checkout/order-received/<number>/ (src/proxy.ts sends those here):
 * WooCommerce's "thank you" line, which the live site shows for any order number. The real order
 * summary comes with the checkout (Phase 5).
 */
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";

import { CheckoutSteps } from "@/components/woocommerce/CheckoutSteps";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { OrderReceived } from "@/components/woocommerce/Notices";
import { WooPage } from "@/components/woocommerce/WooPage";

export const metadata = wooMetadata("Checkout", "/checkout/");

export default function OrderReceivedPage() {
  return (
    <WooPage jsonLdPath="/checkout/order-received/" pageId={11} band={<CheckoutSteps current="complete" />}>
      <OrderReceived />
    </WooPage>
  );
}
