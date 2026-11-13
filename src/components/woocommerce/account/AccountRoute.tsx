/**
 * One My Account address (/my-account/, /my-account/orders/ …), as live answers it: the "My account"
 * band (every endpoint keeps the page's title and breadcrumbs on live), then
 *   * for a visitor: the login and registration forms (also at every endpoint, status 200);
 *   * for a logged-in customer: the account menu and the endpoint (AccountSections.tsx, AccountForms.tsx).
 * Who is logged in comes from the session cookie, so this part is rendered for each request inside
 * <Suspense> (Cache Components). Messages from the previous form (flash cookie) are shown on top.
 */
// As on every live page: AffiliateWP's form styles (also ".screen-reader-text"), Elementor core and kit,
// then the theme (also imported by WooPage, but this order keeps the theme before the account rules).
import "@/styles/legacy/affiliate-wp-forms.css";
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";
import "@/styles/woocommerce.css";
// The shop tables (orders, order details) and prices, as live loads woo-mod-shop-table here too.
import "@/styles/cart.css";
import "@/styles/account.css";
import "@/styles/rewards.css";
import "@/styles/account-dashboard.css";
import "@/styles/usd-prices-owner.css";

import { cookies } from "next/headers";
import { Suspense } from "react";

import { PageTitle } from "@/components/blog/PageTitle";
import { decodeNotices, FLASH_COOKIE, notice, type Notice } from "@/lib/account/notices";
import { getCreditsChip } from "@/lib/account/dashboard";
import { getAccountUser, isStaff, resendTokenFor, type AccountUser } from "@/lib/account/session";

import { AccountLogin } from "../AccountLogin";
import { WooPage } from "../WooPage";

import { AccountNotices } from "./AccountNotices";
import { AccountShell, type AccountEndpoint } from "./AccountShell";
import { EditAccountForm, EditAddressForm } from "./AccountForms";
import { AccountDashboard } from "./AccountDashboard";
import { Addresses, Downloads, loadAddresses, Orders, PaymentMethods, ResearchTools, ViewOrder } from "./AccountSections";
import { Rewards } from "./RewardsTab";

export type AccountView =
  | { endpoint: "dashboard" | "downloads" | "edit-address" | "edit-account" | "payment-methods" | "research-tools" | "rewards" }
  | { endpoint: "orders"; page: Promise<number> | number; searchParams?: Promise<Record<string, string | string[] | undefined>> }
  | { endpoint: "view-order"; number: Promise<string> }
  | { endpoint: "edit-address-form"; type: Promise<"billing" | "shipping"> };

/** The menu item marked as current (view-order belongs to Orders, an address form to Addresses). */
function activeItem(view: AccountView): AccountEndpoint | null {
  if (view.endpoint === "view-order") return "orders";
  if (view.endpoint === "edit-address-form") return "edit-address";
  if (view.endpoint === "payment-methods") return null;
  return view.endpoint;
}

/**
 * WooCommerce 11's reminder on Dashboard and Account details for an account still using the password made
 * up at registration ("Resend" e-mails a new link), hidden for 60 seconds after a resend.
 */
function temporaryPasswordNotice(view: AccountView, user: AccountUser): Notice[] {
  if (!user.temporaryPassword || (view.endpoint !== "dashboard" && view.endpoint !== "edit-account")) return [];
  if (user.setPasswordResentAt && Date.now() - user.setPasswordResentAt.getTime() < 60_000) return [];
  return [
    notice.info(
      { text: "Resend", href: `/my-account/?wc-resend-set-password=1&_wpnonce=${resendTokenFor(user.sessionToken)}`, className: "button wc-forward" },
      " Your account is using a temporary password. We emailed you a link to change your password.",
    ),
  ];
}

async function Endpoint({ view, user, flash: flashed }: { view: AccountView; user: AccountUser; flash: ReturnType<typeof decodeNotices> }) {
  const flash = [...flashed, ...temporaryPasswordNotice(view, user)];
  switch (view.endpoint) {
    case "edit-account":
      return <EditAccountForm values={{ firstName: user.firstName, lastName: user.lastName, displayName: user.displayName, email: user.email }} flash={flash} />;
    case "edit-address-form": {
      const type = await view.type;
      const saved = (await loadAddresses(user.id))[type];
      // A new billing address starts with the account's name and e-mail, as WooCommerce fills it in.
      const values = saved ?? (type === "billing" ? { first_name: [user.firstName, user.lastName].filter(Boolean).join(" "), email: user.email } : { first_name: user.firstName, last_name: user.lastName });
      return <EditAddressForm type={type} values={values} flash={flash} />;
    }
    default:
      break;
  }
  let content: React.ReactNode;
  switch (view.endpoint) {
    case "dashboard":
      content = <AccountDashboard user={user} />;
      break;
    case "orders": {
      const params = view.searchParams ? await view.searchParams : {};
      content = <Orders user={user} page={await view.page} sendVerification={params.wc_send_verification === "1"} />;
      break;
    }
    case "view-order":
      content = <ViewOrder user={user} number={await view.number} />;
      break;
    case "downloads":
      content = <Downloads />;
      break;
    case "edit-address":
      content = <Addresses user={user} />;
      break;
    case "payment-methods":
      content = <PaymentMethods />;
      break;
    case "research-tools":
      content = <ResearchTools />;
      break;
    case "rewards":
      content = <Rewards user={user} />;
      break;
  }
  return (
    <>
      <AccountNotices notices={flash} fromFlash />
      {content}
    </>
  );
}

async function AccountContent({ view }: { view: AccountView }) {
  const flash = decodeNotices((await cookies()).get(FLASH_COOKIE)?.value);
  let user: AccountUser | null = null;
  try {
    user = await getAccountUser();
  } catch (error) {
    // No database (or no tables yet): the page still works for visitors; logging in says it isn't available.
    console.error("[account] session check failed", error);
  }
  if (!user) return <AccountLogin notices={flash} />;
  // The sidebar's credits chip (members only); a problem here only hides the chip.
  const credits = await getCreditsChip(user.id).catch(() => null);
  return (
    <AccountShell active={activeItem(view)} logoutToken={user.logoutToken} profile={{ displayName: user.displayName, email: user.email, staff: isStaff(user), credits }}>
      <Endpoint view={view} user={user} flash={flash} />
    </AccountShell>
  );
}

export function AccountRoute({ view }: { view: AccountView }) {
  return (
    <WooPage jsonLdPath="/my-account/" pageId={12} pageClass="woocommerce-account" band={<PageTitle blog={false} title="My account" crumbs={[{ label: "Home", href: "/" }, { label: "My account" }]} />}>
      <Suspense fallback={null}>
        <AccountContent view={view} />
      </Suspense>
    </WooPage>
  );
}
