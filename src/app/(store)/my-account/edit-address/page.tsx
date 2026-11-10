/**
 * /my-account/edit-address/: the billing and shipping address.
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function AddressesPage() {
  return <AccountRoute view={{ endpoint: "edit-address" }} />;
}
