/**
 * The frame of every My Account page for a logged-in customer (redesigned 13 Nov 2026, on purpose: not WooCommerce's
 * plain menu any more): a warm-black sidebar card with the customer's profile (initials in a gold ring, name, e-mail,
 * rewards credits) and the menu as pills with icons, and the endpoint on the right under its title. On phones the
 * sidebar becomes a profile strip over a row of scrollable pills. Styles: src/styles/account-dashboard.css.
 *
 * This file is also imported by the header's account dropdown (a client component) for the menu list, so it holds no
 * server-only code.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { AccountIcon } from "./AccountIcons";

export type AccountEndpoint = "dashboard" | "orders" | "downloads" | "edit-address" | "edit-account" | "research-tools" | "rewards" | "customer-logout" | "payment-methods";

/** The live menu, in its order. */
export const ACCOUNT_MENU: { endpoint: AccountEndpoint; label: string; href: string }[] = [
  { endpoint: "dashboard", label: "Dashboard", href: "/my-account/" },
  { endpoint: "orders", label: "Orders", href: "/my-account/orders/" },
  { endpoint: "downloads", label: "Downloads", href: "/my-account/downloads/" },
  { endpoint: "edit-address", label: "Addresses", href: "/my-account/edit-address/" },
  { endpoint: "edit-account", label: "Account details", href: "/my-account/edit-account/" },
  { endpoint: "research-tools", label: "Research tools", href: "/my-account/research-tools/" },
  { endpoint: "rewards", label: "Rewards", href: "/my-account/rewards/" },
  { endpoint: "customer-logout", label: "Logout", href: "/my-account/customer-logout/" },
];

/** The menu link of an endpoint; Logout carries the session's token (WooCommerce's _wpnonce). */
export const menuHref = (item: (typeof ACCOUNT_MENU)[number], logoutToken: string) => (item.endpoint === "customer-logout" ? `${item.href}?_wpnonce=${logoutToken}` : item.href);

/** The icon of each menu entry (src/components/woocommerce/account/AccountIcons.tsx). */
export const MENU_ICON: Record<AccountEndpoint, string> = {
  dashboard: "dashboard",
  orders: "orders",
  downloads: "downloads",
  "edit-address": "addresses",
  "edit-account": "account",
  "research-tools": "research",
  rewards: "rewards",
  "customer-logout": "logout",
  "payment-methods": "wallet",
};

/** The page title above the endpoint ("Payment methods" has no menu entry). */
const TITLES: Partial<Record<AccountEndpoint, string>> = { "payment-methods": "Payment methods" };

/** "Budi Santoso" → "BS", "budi" → "B". */
export function initials(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words.length > 1 ? (words[words.length - 1][0] ?? "") : "")).toUpperCase();
}

export type AccountProfile = { displayName: string; email: string; staff: boolean; credits: number | null };

const vars = (values: Record<string, string | number>) => values as CSSProperties;

export function AccountShell({ active, logoutToken, profile, children }: { active: AccountEndpoint | null; logoutToken: string; profile: AccountProfile; children: ReactNode }) {
  const activeLabel = (active && (TITLES[active] ?? ACCOUNT_MENU.find((item) => item.endpoint === active)?.label)) ?? "Payment methods";
  const items = ACCOUNT_MENU.filter((item) => item.endpoint !== "customer-logout");
  const logout = ACCOUNT_MENU.find((item) => item.endpoint === "customer-logout")!;
  return (
    <div className="acct" style={vars({ "--acct-sidebar": "300px" })}>
      <aside className="acct-side" aria-label="Account">
        <div className="acct-profile">
          <span className="acct-avatar" aria-hidden="true">
            {initials(profile.displayName)}
          </span>
          <div className="acct-profile__text">
            <strong className="acct-profile__name">{profile.displayName}</strong>
            <span className="acct-profile__mail">{profile.email}</span>
          </div>
          {profile.credits !== null ? (
            <Link href="/my-account/rewards/" className="acct-credits" title="Your reward credits">
              <AccountIcon name="rewards" size={14} />
              <span>{profile.credits.toLocaleString("en-US")} credits</span>
            </Link>
          ) : null}
        </div>

        <nav className="acct-nav" aria-label="Account pages">
          <ul>
            {items.map((item) => {
              const current = item.endpoint === active;
              return (
                <li key={item.endpoint} className={`woocommerce-MyAccount-navigation-link--${item.endpoint}${current ? " is-active" : ""}`}>
                  <Link href={item.href} aria-current={current ? "page" : undefined}>
                    <span className="acct-nav__icon">
                      <AccountIcon name={MENU_ICON[item.endpoint]} />
                    </span>
                    <span className="acct-nav__label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
            {profile.staff ? (
              <li>
                <Link href="/admin/orders/">
                  <span className="acct-nav__icon">
                    <AccountIcon name="admin" />
                  </span>
                  <span className="acct-nav__label">Store admin</span>
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>

        {/* Logout is a plain link: it leaves the page (a redirect), it isn't a page of its own. */}
        <a className="acct-logout" href={menuHref(logout, logoutToken)}>
          <AccountIcon name="logout" size={18} />
          <span>Log out</span>
        </a>
      </aside>

      <section className="acct-main" data-endpoint={active ?? "other"}>
        {active === "dashboard" ? null : (
          <header className="acct-main__head">
            <h2 className="acct-main__title">{activeLabel}</h2>
          </header>
        )}
        <div className="woocommerce-MyAccount-content acct-content">{children}</div>
      </section>
    </div>
  );
}
