/**
 * /my-account/edit-address/billing/ and …/shipping/: the address forms (src/proxy.ts answers any other
 * type with the Addresses page).
 */
import { AccountRoute } from "@/components/woocommerce/account/AccountRoute";
import { wooMetadata } from "@/components/woocommerce/metadata";

export const metadata = wooMetadata("My account", "/my-account/");

export function generateStaticParams() {
  return [{ type: "billing" }, { type: "shipping" }];
}

export default function EditAddressPage({ params }: { params: Promise<{ type: string }> }) {
  return <AccountRoute view={{ endpoint: "edit-address-form", type: params.then((p) => (p.type === "shipping" ? "shipping" : "billing")) }} />;
}
