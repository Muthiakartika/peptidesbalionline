/**
 * What /my-account/lost-password/?reset-link-sent=true shows (src/proxy.ts sends that address here;
 * /woo/… itself answers 404, like the other internal routes).
 */
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";

import { PageTitle } from "@/components/blog/PageTitle";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { FlashNotices } from "@/components/woocommerce/account/FlashNotices";
import { ResetLinkSent } from "@/components/woocommerce/Notices";
import { WooPage } from "@/components/woocommerce/WooPage";

export const metadata = wooMetadata("My account", "/my-account/");

export default function ResetLinkSentPage() {
  return (
    <WooPage jsonLdPath="/my-account/lost-password/" pageId={12} band={<PageTitle blog={false} title="Lost password" crumbs={[{ label: "Home", href: "/" }, { label: "My account" }]} />}>
      <FlashNotices />
      <ResetLinkSent />
    </WooPage>
  );
}
