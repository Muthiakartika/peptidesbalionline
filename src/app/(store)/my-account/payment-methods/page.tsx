/**
 * /my-account/payment-methods/ (not in the live menu, but WooCommerce answers it).
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function PaymentMethodsPage() {
  return <AccountRoute view={{ endpoint: "payment-methods" }} />;
}
