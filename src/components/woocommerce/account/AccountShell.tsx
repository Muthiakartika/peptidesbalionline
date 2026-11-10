/**
 * The frame of every My Account page for a logged-in customer, as on live (Woodmart's "predefined" My
 * Account layout): the menu on the left ("My account", Dashboard … Logout), the endpoint on the right.
 * The menu is the live one, including the owner's "Research tools" (the Atlas Research Planner plugin).
 * Styles: src/styles/account.css.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type AccountEndpoint = "dashboard" | "orders" | "downloads" | "edit-address" | "edit-account" | "research-tools" | "customer-logout" | "payment-methods";

/** The live menu, in its order. */
export const ACCOUNT_MENU: { endpoint: AccountEndpoint; label: string; href: string }[] = [
  { endpoint: "dashboard", label: "Dashboard", href: "/my-account/" },
  { endpoint: "orders", label: "Orders", href: "/my-account/orders/" },
  { endpoint: "downloads", label: "Downloads", href: "/my-account/downloads/" },
  { endpoint: "edit-address", label: "Addresses", href: "/my-account/edit-address/" },
  { endpoint: "edit-account", label: "Account details", href: "/my-account/edit-account/" },
  { endpoint: "research-tools", label: "Research tools", href: "/my-account/research-tools/" },
  { endpoint: "customer-logout", label: "Logout", href: "/my-account/customer-logout/" },
];

/** The menu link of an endpoint; Logout carries the session's token (WooCommerce's _wpnonce). */
export const menuHref = (item: (typeof ACCOUNT_MENU)[number], logoutToken: string) => (item.endpoint === "customer-logout" ? `${item.href}?_wpnonce=${logoutToken}` : item.href);

const vars = (values: Record<string, string | number>) => values as CSSProperties;

export function AccountShell({ active, logoutToken, children }: { active: AccountEndpoint | null; logoutToken: string; children: ReactNode }) {
  return (
    <div className="wd-my-account-wrapper wd-grid-g" style={vars({ "--wd-col-lg": 12, "--wd-gap-lg": "30px", "--wd-gap-sm": "20px" })}>
      <div className="wd-my-account-sidebar wd-grid-col" style={vars({ "--wd-col-lg": 3, "--wd-col-md": 4, "--wd-col-sm": 12 })}>
        <h3 className="woocommerce-MyAccount-title entry-title">My account</h3>
        <nav className="woocommerce-MyAccount-navigation" aria-label="Account pages">
          <ul>
            {ACCOUNT_MENU.map((item) => {
              const current = item.endpoint === active;
              return (
                <li key={item.endpoint} className={`woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--${item.endpoint}${current ? " is-active" : ""}`}>
                  {/* Logout is a plain link: it leaves the page (a redirect), it isn't a page of its own. */}
                  {item.endpoint === "customer-logout" ? (
                    <a href={menuHref(item, logoutToken)}>{item.label}</a>
                  ) : (
                    <Link href={item.href} aria-current={current ? "page" : undefined}>
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="woocommerce-MyAccount-content wd-grid-col" style={vars({ "--wd-col-lg": 9, "--wd-col-md": 8, "--wd-col-sm": 12 })}>
        {children}
      </div>
    </div>
  );
}
