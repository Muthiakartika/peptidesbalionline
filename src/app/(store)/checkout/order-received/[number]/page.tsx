/**
 * /checkout/order-received/<number>/?key=wc_order_…: the thank-you page with the order (ThankYou.tsx).
 * The order shows only with its key (the link "Place order" sends the buyer to), as WooCommerce does;
 * otherwise only the thank-you line, as live shows for any number.
 */
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";
import "@/styles/woocommerce.css";
import "@/styles/cart.css";
import "@/styles/account.css";
import "@/styles/usd-prices-owner.css";

import { Suspense } from "react";

import { CheckoutSteps } from "@/components/woocommerce/CheckoutSteps";
import { wooMetadata } from "@/components/woocommerce/metadata";
import { ThankYou } from "@/components/woocommerce/order/ThankYou";
import { WooPage } from "@/components/woocommerce/WooPage";
import { getAccountUser } from "@/lib/account/session";
import { getOrderWithLines } from "@/lib/commerce/orders";

export const metadata = wooMetadata("Checkout", "/checkout/");

export function generateStaticParams() {
  return [{ number: "1" }];
}

type Props = { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Received({ params, searchParams }: Props) {
  const { number } = await params;
  const key = (await searchParams).key;
  let view = null;
  let showEmail = false;
  try {
    view = typeof key === "string" && key.startsWith("wc_order_") ? await getOrderWithLines(number, { key }) : null;
    if (view?.order.userId) showEmail = (await getAccountUser().catch(() => null))?.id === view.order.userId;
  } catch (error) {
    console.error("[order-received] database error", error);
  }
  return <ThankYou view={view} showEmail={showEmail} />;
}

export default function OrderReceivedNumberPage(props: Props) {
  return (
    <WooPage jsonLdPath="/checkout/order-received/" pageId={11} pageClass="woocommerce-checkout woocommerce-order-received" band={<CheckoutSteps current="complete" />}>
      <Suspense fallback={null}>
        <Received {...props} />
      </Suspense>
    </WooPage>
  );
}
