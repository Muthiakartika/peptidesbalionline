/**
 * /my-account/edit-account/: "Account details".
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function AccountDetailsPage() {
  return <AccountRoute view={{ endpoint: "edit-account" }} />;
}
