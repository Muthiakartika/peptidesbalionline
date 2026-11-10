"use client";

/**
 * /my-account/lost-password/, WooCommerce's two forms (myaccount/form-lost-password.php and
 * form-reset-password.php):
 *   * LostPasswordForm: "Lost your password?" → the Server Action requestPasswordLink e-mails a link
 *     (in development the e-mail is saved in .data/mail), then the page says the e-mail was sent;
 *   * ResetPasswordForm: the e-mail's link (?key=…&id=…) → "Enter a new password below." → the Server
 *     Action resetPasswordWithKey, then My Account with "Your password has been reset successfully."
 * Their messages appear in the notices wrapper above, as WooCommerce prints them.
 */
import { useState, useTransition, type FormEvent } from "react";

import { requestPasswordLink, resetPasswordWithKey } from "@/app/(store)/my-account/actions";
import type { Notice } from "@/lib/account/notices";
import { useHydrated } from "@/lib/useHydrated";

import { AccountNotices } from "./account/AccountNotices";

function useSend(action: (form: FormData) => Promise<{ notices: Notice[]; redirect?: string }>) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const result = await action(data);
      if (result.redirect) return window.location.assign(result.redirect);
      setNotices(result.notices);
    });
  };
  return { notices, submit, disabled: pending || !hydrated };
}

export function LostPasswordForm() {
  const { notices, submit, disabled } = useSend(requestPasswordLink);
  return (
    <>
      <AccountNotices notices={notices} />
      <form method="post" className="woocommerce-ResetPassword lost_reset_password" onSubmit={submit}>
        <p>Lost your password? Please enter your username or email address. You will receive a link to create a new password via email.</p>
        <p className="woocommerce-form-row woocommerce-form-row--first form-row form-row-first">
          <label htmlFor="user_login">
            Username or email&nbsp;<span className="required" aria-hidden="true">*</span>
            <span className="screen-reader-text">Required</span>
          </label>
          <input className="woocommerce-Input woocommerce-Input--text input-text" type="text" name="user_login" id="user_login" autoComplete="username" required aria-required="true" />
        </p>
        <div className="clear" />
        <p className="woocommerce-form-row form-row">
          <input type="hidden" name="wc_reset_password" value="true" />
          <button type="submit" className="woocommerce-Button button" value="Reset password" disabled={disabled}>
            Reset password
          </button>
        </p>
        <input type="hidden" id="woocommerce-lost-password-nonce" name="woocommerce-lost-password-nonce" value="" />
        <input type="hidden" name="_wp_http_referer" value="" />
      </form>
    </>
  );
}

export function ResetPasswordForm({ resetKey, login }: { resetKey: string; login: string }) {
  const { notices, submit, disabled } = useSend(resetPasswordWithKey);
  const required = (
    <>
      &nbsp;<span className="required" aria-hidden="true">*</span>
      <span className="screen-reader-text">Required</span>
    </>
  );
  return (
    <>
      <AccountNotices notices={notices} />
      <form method="post" className="woocommerce-ResetPassword lost_reset_password" onSubmit={submit}>
        <p>Enter a new password below.</p>
        <p className="woocommerce-form-row woocommerce-form-row--first form-row form-row-first">
          <label htmlFor="password_1">New password{required}</label>
          <input type="password" className="woocommerce-Input woocommerce-Input--text input-text" name="password_1" id="password_1" autoComplete="new-password" required aria-required="true" />
        </p>
        <p className="woocommerce-form-row woocommerce-form-row--last form-row form-row-last">
          <label htmlFor="password_2">Re-enter new password{required}</label>
          <input type="password" className="woocommerce-Input woocommerce-Input--text input-text" name="password_2" id="password_2" autoComplete="new-password" required aria-required="true" />
        </p>
        <input type="hidden" name="reset_key" value={resetKey} />
        <input type="hidden" name="reset_login" value={login} />
        <div className="clear" />
        <p className="woocommerce-form-row form-row">
          <input type="hidden" name="wc_reset_password" value="true" />
          <button type="submit" className="woocommerce-Button button" value="Save" disabled={disabled}>
            Save
          </button>
        </p>
      </form>
    </>
  );
}
