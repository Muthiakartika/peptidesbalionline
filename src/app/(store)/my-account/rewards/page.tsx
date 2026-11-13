/**
 * /my-account/rewards/: the Rewards tab (credits, coupons, share link). Rules: src/lib/loyalty/rules.ts.
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export default function RewardsPage() {
  return <AccountRoute view={{ endpoint: "rewards" }} />;
}
