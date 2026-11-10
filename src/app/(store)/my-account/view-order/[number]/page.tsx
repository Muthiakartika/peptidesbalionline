/**
 * /my-account/view-order/<number>/: one of the customer's orders, or WooCommerce's "Invalid order."
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export function generateStaticParams() {
  return [{ number: "1" }];
}

export default function ViewOrderPage({ params }: { params: Promise<{ number: string }> }) {
  return <AccountRoute view={{ endpoint: "view-order", number: params.then((p) => p.number) }} />;
}
