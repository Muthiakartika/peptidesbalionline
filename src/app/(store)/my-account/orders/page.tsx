/**
 * /my-account/orders/: the customer's orders (page 1). `?wc_send_verification=1` is the "Confirm email
 * address" button.
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AccountRoute view={{ endpoint: "orders", page: 1, searchParams }} />;
}
