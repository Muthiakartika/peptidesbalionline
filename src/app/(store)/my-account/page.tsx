/**
 * /my-account/: the account dashboard for a logged-in customer, the login and registration forms for a
 * visitor (src/components/woocommerce/account/AccountRoute.tsx).
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function MyAccountPage() {
  return <AccountRoute view={{ endpoint: "dashboard" }} />;
}
