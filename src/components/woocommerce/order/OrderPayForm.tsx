"use client";

/**
 * The order-pay page's forms (client):
 *   * PayForm: WooCommerce 11.2.1's checkout/form-pay.php: the order table (Product, Qty, Totals), the
 *     payment methods, the terms checkbox and "Pay for order", sent to the Server Action payForOrder;
 *   * PayLogin: "Please log in to your account below to continue to the payment form." with the theme's
 *     login form (the checkout's markup), sent to logIn and back to this page.
 */
import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { payForOrder } from "@/app/(store)/checkout/order-pay/actions";
import { logIn } from "@/app/(store)/my-account/actions";
import { NoticeList } from "@/components/woocommerce/account/AccountNotices";
import type { Notice } from "@/lib/account/notices";
import { useHydrated } from "@/lib/useHydrated";

import { PasswordInput } from "../PasswordInput";

export type PayMethod = { id: string; title: string; description: string; logo?: { src: string; alt: string } };

export function PayForm({ number, orderKey, table, methods }: { number: string; orderKey: string; table: ReactNode; methods: PayMethod[] }) {
  const [chosen, setChosen] = useState(methods[0]?.id ?? "");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const result = await payForOrder(number, orderKey, String(data.get("payment_method") ?? ""), data.get("terms") === "on");
      if (result.redirect) return window.location.assign(result.redirect);
      setNotices(result.notices);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  return (
    <>
      {notices.length ? (
        <div className="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">
          <NoticeList notices={notices} />
        </div>
      ) : null}
      <form id="order_review" method="post" onSubmit={submit}>
        {table}
        <div id="payment">
          <ul className="wc_payment_methods payment_methods methods" aria-label="Payment methods">
            {methods.map((method) => (
              <li key={method.id} className={`wc_payment_method payment_method_${method.id}`}>
                <input id={`payment_method_${method.id}`} type="radio" className="input-radio" name="payment_method" value={method.id} checked={chosen === method.id} onChange={() => setChosen(method.id)} data-order_button_text="" />
                <label htmlFor={`payment_method_${method.id}`}>
                  {" "}
                  {method.title}{" "}
                  {method.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the providers' own logos, as on the checkout
                    <img src={method.logo.src} alt={method.logo.alt} />
                  ) : null}
                </label>
                <div className={`payment_box payment_method_${method.id}`} style={chosen === method.id ? undefined : { display: "none" }}>
                  <p>{method.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="form-row">
            <input type="hidden" name="woocommerce_pay" value="1" />
            <div className="woocommerce-terms-and-conditions-wrapper">
              <div className="woocommerce-privacy-policy-text">
                <p>
                  Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our{" "}
                  <Link href="/privacy-policy/" className="woocommerce-privacy-policy-link" target="_blank">
                    privacy policy
                  </Link>
                  .
                </p>
              </div>
              <p className="form-row validate-required">
                <label className="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
                  <input type="checkbox" className="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox" name="terms" id="terms" />{" "}
                  <span className="woocommerce-terms-and-conditions-checkbox-text">
                    I confirm I am 21 or older and purchasing for laboratory research use only, not for human consumption. I have read and agree to the Terms of Service and Medical &amp; Research Disclaimer.
                  </span>
                  &nbsp;
                  <abbr className="required" title="required">
                    *
                  </abbr>
                </label>
                <input type="hidden" name="terms-field" value="1" />
              </p>
            </div>
            <button type="submit" className="button alt" id="place_order" value="Pay for order" data-value="Pay for order" disabled={!hydrated || pending}>
              Pay for order
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

export function PayLogin({ redirect }: { redirect: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("redirect", redirect);
    start(async () => {
      const result = await logIn(data);
      if (result.redirect) return window.location.assign(result.redirect);
      setNotices(result.notices);
    });
  };
  return (
    <>
      <div className="woocommerce-notices-wrapper">
        <NoticeList notices={notices} />
      </div>
      <div className="woocommerce-info" role="status">
        Please log in to your account below to continue to the payment form.
      </div>
      <form className="woocommerce-form woocommerce-form-login login" method="post" onSubmit={submit}>
        <p className="woocommerce-FormRow woocommerce-FormRow--wide form-row form-row-wide form-row-username">
          <label htmlFor="username">
            Username or email address&nbsp;
            <span className="required" aria-hidden="true">
              *
            </span>
            <span className="screen-reader-text">Required</span>
          </label>
          <input type="text" className="woocommerce-Input woocommerce-Input--text input-text" name="username" id="username" autoComplete="username" />
        </p>
        <p className="woocommerce-FormRow woocommerce-FormRow--wide form-row form-row-wide form-row-password">
          <label htmlFor="password">
            Password&nbsp;
            <span className="required" aria-hidden="true">
              *
            </span>
            <span className="screen-reader-text">Required</span>
          </label>
          <PasswordInput className="woocommerce-Input woocommerce-Input--text input-text" name="password" id="password" autoComplete="current-password" />
        </p>
        <p className="form-row form-row-btn">
          <button type="submit" className="button woocommerce-button woocommerce-form-login__submit" name="login" value="Log in" disabled={!hydrated || pending}>
            Log in
          </button>
        </p>
        <p className="login-form-footer">
          <Link href="/my-account/lost-password/" className="woocommerce-LostPassword lost_password">
            Lost your password?
          </Link>
          <label className="woocommerce-form__label woocommerce-form__label-for-checkbox woocommerce-form-login__rememberme">
            <input className="woocommerce-form__input woocommerce-form__input-checkbox" name="rememberme" type="checkbox" value="forever" title="Remember me" aria-label="Remember me" /> <span>Remember me</span>
          </label>
        </p>
      </form>
    </>
  );
}
