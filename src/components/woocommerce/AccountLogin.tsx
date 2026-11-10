"use client";

/**
 * /my-account/ for a visitor who is not logged in (also every account address, e.g.
 * /my-account/orders/): WooCommerce's login and registration forms in Woodmart's "tabs" layout.
 * Left: the login form; right: "Or" · "Register" · the text, and a button that swaps the login
 * form for the registration form (and back), as the theme's script does: on screens narrower than
 * 769px it also scrolls the page up to the forms.
 *
 * The forms are sent by JavaScript to the Server Actions logIn and register
 * (src/app/(store)/my-account/actions.ts), which answer with WooCommerce's and WordPress's messages, shown
 * in the notices wrapper above the forms; on success the page changes (back to the page the visitor was
 * on, as WooCommerce's referer redirect). Next.js's Server Actions check where a request comes from, so the
 * security fields WooCommerce fills in (nonces) stay empty. Left for later: the hidden fields
 * WooCommerce's order-attribution script adds to <wc-order-attribution-inputs> (where the visitor came from).
 */
import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { logIn, register as registerAccount } from "@/app/(store)/my-account/actions";
import type { Notice } from "@/lib/account/notices";
import { animateScrollTop } from "@/lib/elementor/slide";
import { useHydrated } from "@/lib/useHydrated";

import { AccountNotices } from "./account/AccountNotices";
import { PasswordInput } from "./PasswordInput";

// WooCommerce's order-attribution element (its script fills in hidden fields saying where the
// visitor came from; empty here). A custom element, so TypeScript has to be told it exists.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "wc-order-attribution-inputs": React.HTMLAttributes<HTMLElement>;
    }
  }
}

export function AccountLogin({ notices: flash = [] }: { notices?: Notice[] }) {
  const [register, setRegister] = useState(false);
  const [notices, setNotices] = useState<Notice[]>(flash);
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const tabs = useRef<HTMLDivElement>(null);

  const send = (action: (form: FormData) => Promise<{ notices: Notice[]; redirect?: string }>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // WooCommerce goes back to the page the form was sent from (the referer).
    data.set("redirect", window.location.pathname + window.location.search);
    start(async () => {
      const result = await action(data);
      if (result.redirect) return window.location.assign(result.redirect);
      setNotices(result.notices);
      if (result.notices.length) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const switchForms = (event: React.MouseEvent) => {
    event.preventDefault();
    setRegister((shown) => !shown);
    const element = tabs.current;
    if (element && document.documentElement.clientWidth < 769) {
      // To 100px above the forms (measured on the live site: forms at 261px -> scrolled to 161px).
      animateScrollTop(element.getBoundingClientRect().top + window.scrollY - 100, 400);
    }
  };

  return (
    <>
      <AccountNotices notices={notices} fromFlash={notices === flash} />
      <div ref={tabs} className={`wd-registration-page wd-register-tabs${register ? " active-register" : ""}`}>
        <div className="wd-grid-f-col" id="customer_login">
          <div className="wd-col col-login">
            <h2 className="wd-login-title">Login</h2>
            {/* The live form has the same id as its wrapper ("customer_login"); kept, the theme's CSS reads it. */}
            <form className="login woocommerce-form woocommerce-form-login hidden-form" method="post" action="/my-account/?action=login" id="customer_login" onSubmit={send(logIn)} aria-busy={pending || undefined}>
              <p className="woocommerce-FormRow woocommerce-FormRow--wide form-row form-row-wide form-row-username">
                <label htmlFor="username">
                  Username or email address&nbsp;<span className="required" aria-hidden="true">*</span>
                  <span className="screen-reader-text">Required</span>
                </label>
                <input type="text" className="woocommerce-Input woocommerce-Input--text input-text" name="username" id="username" autoComplete="username" defaultValue="" />{" "}
              </p>
              <p className="woocommerce-FormRow woocommerce-FormRow--wide form-row form-row-wide form-row-password">
                <label htmlFor="password">
                  Password&nbsp;<span className="required" aria-hidden="true">*</span>
                  <span className="screen-reader-text">Required</span>
                </label>
                <PasswordInput className="woocommerce-Input woocommerce-Input--text input-text" name="password" id="password" autoComplete="current-password" />
              </p>
              <p className="form-row form-row-btn">
                <input type="hidden" id="woocommerce-login-nonce" name="woocommerce-login-nonce" value="" />
                <input type="hidden" name="_wp_http_referer" value="" />{" "}
                <button type="submit" className="button woocommerce-button woocommerce-form-login__submit" name="login" value="Log in" disabled={!hydrated || pending}>
                  Log in
                </button>
              </p>
              <p className="login-form-footer">
                <Link href="/my-account/lost-password/" className="woocommerce-LostPassword lost_password">
                  Lost your password?
                </Link>
                <label className="woocommerce-form__label woocommerce-form__label-for-checkbox woocommerce-form-login__rememberme">
                  <input className="woocommerce-form__input woocommerce-form__input-checkbox" name="rememberme" type="checkbox" value="forever" title="Remember me" aria-label="Remember me" />{" "}
                  <span>Remember me</span>
                </label>
              </p>
            </form>
          </div>
          <div className="wd-col col-register">
            <h2 className="wd-login-title">Register</h2>
            <form method="post" action="/my-account/?action=register" className="woocommerce-form woocommerce-form-register register" onSubmit={send(registerAccount)} aria-busy={pending || undefined}>
              <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
                <label htmlFor="reg_email">
                  Email address&nbsp;<span className="required" aria-hidden="true">*</span>
                  <span className="screen-reader-text">Required</span>
                </label>
                <input type="email" className="woocommerce-Input woocommerce-Input--text input-text" name="email" id="reg_email" autoComplete="email" defaultValue="" />{" "}
              </p>
              <p>A link to set a new password will be sent to your email address.</p>
              {/* WooCommerce's anti-spam trap: a field people never see, so only robots fill it in. */}
              <div style={{ left: "-999em", position: "absolute" }}>
                <label htmlFor="trap">Anti-spam</label>
                <input type="text" name="email_2" id="trap" tabIndex={-1} />
              </div>
              <wc-order-attribution-inputs />
              <div className="woocommerce-privacy-policy-text">
                <p>
                  Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our{" "}
                  <Link href="/privacy-policy/" className="woocommerce-privacy-policy-link" target="_blank">
                    privacy policy
                  </Link>
                  .
                </p>
              </div>
              <p className="woocommerce-form-row form-row form-row-btn">
                <input type="hidden" id="woocommerce-register-nonce" name="woocommerce-register-nonce" value="" />
                <input type="hidden" name="_wp_http_referer" value="" />{" "}
                <button type="submit" className="woocommerce-Button woocommerce-button button" name="register" value="Register" disabled={!hydrated || pending}>
                  Register
                </button>
              </p>
            </form>
          </div>
          <div className="wd-col col-register-text">
            <p className="title wd-login-divider">
              <span>Or</span>
            </p>
            <h2 className="wd-login-title">Register</h2>
            <div className="registration-info">
              Registering for this site allows you to access your order status and history. Just fill in the fields below, and we&apos;ll get a new account set up for you in no time. We will only ask you for
              information necessary to make the purchase process faster and easier.
            </div>
            <a
              href="#"
              rel="nofollow noopener"
              className="btn wd-switch-to-register"
              data-login="Login"
              data-login-title="Login"
              data-reg-title="Register"
              data-register="Register"
              onClick={switchForms}
            >
              {register ? "Login" : "Register"}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
