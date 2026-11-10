/**
 * /my-account/downloads/.
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function DownloadsPage() {
  return <AccountRoute view={{ endpoint: "downloads" }} />;
}
