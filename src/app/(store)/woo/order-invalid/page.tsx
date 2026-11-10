/**
 * What /checkout/order-pay/<number>/ shows on the live site for an order that cannot be paid (every
 * number, until orders exist in Phase 5). src/proxy.ts sends those addresses here; /woo/… itself
 * answers 404.
 */
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";

import { CheckoutSteps } from "@/components/woocommerce/CheckoutSteps";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { OrderInvalid } from "@/components/woocommerce/Notices";
import { WooPage } from "@/components/woocommerce/WooPage";

export const metadata = wooMetadata("Checkout", "/checkout/");

export default function OrderInvalidPage() {
  return (
    <WooPage jsonLdPath="/checkout/order-pay/" pageId={11} band={<CheckoutSteps current="checkout" />}>
      <OrderInvalid />
    </WooPage>
  );
}
