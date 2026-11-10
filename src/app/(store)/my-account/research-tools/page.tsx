/**
 * /my-account/research-tools/: the owner's "Research tools" tab (Atlas Research Planner plugin).
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function ResearchToolsPage() {
  return <AccountRoute view={{ endpoint: "research-tools" }} />;
}
