"use client";

/**
 * The header's account icon and its hover dropdown (desktop), as on live:
 *   * a visitor: "Sign in" with WooCommerce's login form (same fields and wording), sent to the Server
 *     Action logIn; its messages appear above the form, and on success the page loads again, logged in;
 *   * a logged-in customer: the account menu (Dashboard … Logout), Woodmart's menu dropdown.
 * Which one comes from the "logged in" cookie (src/lib/account/account-cookie.ts), read in the browser:
 * the header is built in advance and the same for everyone, so the server HTML is the visitor's version.
 */
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";

import { logIn } from "@/app/(store)/my-account/actions";
import { NoticeList } from "@/components/woocommerce/account/AccountNotices";
import { ACCOUNT_MENU, menuHref } from "@/components/woocommerce/account/AccountShell";
import { Icon } from "@/components/ui/Icon";
import { readAccountTokenInBrowser } from "@/lib/account/account-cookie";
import type { Notice } from "@/lib/account/notices";
import { useHydrated } from "@/lib/useHydrated";

const noSubscription = () => () => {};

export function AccountMenu() {
  const token = useSyncExternalStore(noSubscription, readAccountTokenInBrowser, () => null);
  const hydrated = useHydrated();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, start] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("redirect", window.location.pathname + window.location.search);
    start(async () => {
      const result = await logIn(data);
      if (result.redirect) return window.location.assign(result.redirect);
      setNotices(result.notices);
    });
  };

  return (
    // As tall as the icon (40px), like live's .wd-header-my-account: its dropdowns open 30px below that box.
    <div className="has-dropdown relative flex items-center">
      <Link href="/my-account/" title="My account" className="header-tool">
        <Icon name="account" />
        <span className="sr-only">{token ? "My Account" : "Login / Register"}</span>
      </Link>
      {token ? (
        <div className="dropdown dropdown--right">
          <ul>
            {ACCOUNT_MENU.map((item) => (
              <li key={item.endpoint} className={`dropdown__item woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--${item.endpoint}`}>
                {item.endpoint === "customer-logout" ? (
                  <a href={menuHref(item, token)} className="dropdown__link">
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <Link href={item.href} className="dropdown__link">
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="dropdown dropdown--right account-dropdown">
          <div className="account-dropdown__heading">
            <span className="account-dropdown__title">Sign in</span>
            <Link href="/my-account/?action=register" className="text-gold">
              Create an Account
            </Link>
          </div>
          {notices.length ? (
            <div className="woocommerce-notices-wrapper account-dropdown__notices">
              <NoticeList notices={notices} />
            </div>
          ) : null}
          <form method="post" action="/my-account/" onSubmit={submit} aria-busy={pending || undefined}>
            <p className="mb-[15px]">
              <label htmlFor="header-username" className="form-label">
                Username or email address&nbsp;<span className="form-required" aria-hidden="true">*</span>
                <span className="sr-only">Required</span>
              </label>
              <input id="header-username" type="text" name="username" autoComplete="username" className="form-input" />
            </p>
            <p className="mb-[15px]">
              <label htmlFor="header-password" className="form-label">
                Password&nbsp;<span className="form-required" aria-hidden="true">*</span>
                <span className="sr-only">Required</span>
              </label>
              <input id="header-password" type="password" name="password" autoComplete="current-password" className="form-input" />
            </p>
            <p className="mb-[15px]">
              <button type="submit" name="login" value="Log in" className="btn-accented w-full" disabled={!hydrated || pending}>
                Log in
              </button>
            </p>
            <p className="flex items-center justify-between gap-[10px]">
              <label className="flex items-center text-title">
                <input type="checkbox" name="rememberme" value="forever" className="mr-[5px]" aria-label="Remember me" />
                <span>Remember me</span>
              </label>
              <Link href="/my-account/lost-password/" className="text-gold">
                Lost your password?
              </Link>
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
