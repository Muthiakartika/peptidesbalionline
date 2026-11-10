/**
 * /my-account/orders/<n>/: a page of the customer's orders (src/proxy.ts sends only whole numbers here;
 * WordPress shows page 1 for anything else).
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

// Built in advance for page 2; any other page number is rendered when asked for (the list depends on who is
// logged in anyway).
export function generateStaticParams() {
  return [{ page: "2" }];
}

export default function OrdersPagePage({ params }: { params: Promise<{ page: string }> }) {
  return <AccountRoute view={{ endpoint: "orders", page: params.then((p) => Math.max(1, Number.parseInt(p.page, 10) || 1)) }} />;
}
