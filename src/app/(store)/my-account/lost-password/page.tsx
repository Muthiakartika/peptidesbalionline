/**
 * /my-account/lost-password/: WooCommerce's "Lost your password?" form, or, from the e-mail's link
 * (?key=…&id=…), "Enter a new password below." (src/components/woocommerce/LostPassword.tsx). The
 * confirmation shown after sending (?reset-link-sent=true) is src/app/(store)/woo/reset-link-sent/, where
 * src/proxy.ts sends that address. The link's key decides the form, so that part is rendered per request.
 */
// As on every live page: AffiliateWP's form styles (also ".screen-reader-text"), Elementor core and
// kit, then the theme (imported by WooPage).
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";

import { Suspense } from "react";

import { PageTitle } from "@/components/blog/PageTitle";
import { LostPasswordForm, ResetPasswordForm } from "@/components/woocommerce/LostPassword";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { WooPage } from "@/components/woocommerce/WooPage";

export const metadata = wooMetadata("My account", "/my-account/");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : "";
  const id = typeof params.id === "string" ? params.id : "";
  return key && id ? <ResetPasswordForm resetKey={key} login={id} /> : <LostPasswordForm />;
}

export default function LostPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <WooPage jsonLdPath="/my-account/lost-password/" pageId={12} band={<PageTitle blog={false} title="Lost password" crumbs={[{ label: "Home", href: "/" }, { label: "My account" }]} />}>
      <Suspense fallback={<LostPasswordForm />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </WooPage>
  );
}
