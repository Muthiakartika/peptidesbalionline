"use client";

/**
 * The two My Account forms, markup as on live (fetched 7 Nov 2026):
 *   * EditAddressForm: /my-account/edit-address/billing/ and …/shipping/ (the owner's Checkout Field
 *     Editor fields: billing "Full name" and "WhatsApp Number"; shipping first and last name and "Phone");
 *   * EditAccountForm: /my-account/edit-account/ (names, display name, e-mail, password change).
 * They are sent by JavaScript to the Server Actions (src/app/(store)/my-account/actions.ts), which check
 * them with WooCommerce's rules: errors come back into the notices; on success the page changes, as live.
 */
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { saveAccountDetails, saveAddress } from "@/app/(store)/my-account/actions";
import type { Notice } from "@/lib/account/notices";
import type { AddressType } from "@/lib/account/validation";
import { indonesiaStates } from "@/lib/commerce/store-settings";
import { useHydrated } from "@/lib/useHydrated";

import { PasswordInput } from "../PasswordInput";

import { AccountNotices } from "./AccountNotices";

type FieldSpec = {
  key: string;
  label: string;
  className: string;
  input: "text" | "tel" | "email" | "country" | "state";
  autoComplete: string;
  placeholder?: string;
};

const FIELDS: Record<AddressType, FieldSpec[]> = {
  billing: [
    { key: "first_name", label: "Full name", className: "form-row form-row-wide thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required", input: "text", autoComplete: "given-name" },
    { key: "phone", label: "WhatsApp Number", className: "form-row form-row-first thwcfd-required thwcfd-field-wrapper thwcfd-field-tel validate-required validate-phone", input: "tel", autoComplete: "tel" },
    { key: "email", label: "Email address", className: "form-row form-row-wide thwcfd-required thwcfd-field-wrapper thwcfd-field-email validate-required validate-email", input: "email", autoComplete: "email" },
    { key: "country", label: "Country / Region", className: "form-row form-row-wide address-field update_totals_on_change thwcfd-required thwcfd-field-wrapper thwcfd-field-country validate-required", input: "country", autoComplete: "country" },
    { key: "address_1", label: "Street address", className: "form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required", input: "text", autoComplete: "address-line1", placeholder: "House number and street name" },
    { key: "city", label: "Town / City", className: "form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required", input: "text", autoComplete: "address-level2" },
    { key: "state", label: "State / County", className: "form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-state validate-required validate-state", input: "state", autoComplete: "address-level1" },
    { key: "postcode", label: "Postcode / ZIP", className: "form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required validate-postcode", input: "text", autoComplete: "postal-code" },
  ],
  shipping: [
    { key: "first_name", label: "First name", className: "form-row form-row-first validate-required", input: "text", autoComplete: "given-name" },
    { key: "last_name", label: "Last name", className: "form-row form-row-last validate-required", input: "text", autoComplete: "family-name" },
    { key: "country", label: "Country / Region", className: "form-row form-row-wide address-field update_totals_on_change validate-required", input: "country", autoComplete: "country" },
    { key: "address_1", label: "Street address", className: "form-row form-row-wide address-field validate-required", input: "text", autoComplete: "address-line1", placeholder: "House number and street name" },
    { key: "city", label: "Town / City", className: "form-row form-row-wide address-field validate-required", input: "text", autoComplete: "address-level2" },
    { key: "state", label: "State / County", className: "form-row form-row-wide address-field validate-required validate-state", input: "state", autoComplete: "address-level1" },
    { key: "postcode", label: "Postcode / ZIP", className: "form-row form-row-wide address-field validate-required validate-postcode", input: "text", autoComplete: "postal-code" },
    { key: "phone", label: "Phone", className: "form-row form-row-wide validate-required validate-phone", input: "tel", autoComplete: "tel" },
  ],
};

function Required() {
  return (
    <>
      &nbsp;
      <span className="required" aria-hidden="true">
        *
      </span>
    </>
  );
}

/** Sends the form to an action; returns its messages (on success the action changes the page). */
function useAccountForm(action: (form: FormData) => Promise<{ notices: Notice[] }>, initial: Notice[]) {
  const [notices, setNotices] = useState<Notice[]>(initial);
  const [transitioning, start] = useTransition();
  const hydrated = useHydrated();
  const pending = transitioning || !hydrated;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const result = await action(data);
      setNotices(result.notices);
      if (result.notices.length) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  return { notices, pending, submit, fromFlash: notices === initial };
}

export function EditAddressForm({ type, values, flash }: { type: AddressType; values: Record<string, string>; flash: Notice[] }): ReactNode {
  const { notices, pending, submit, fromFlash } = useAccountForm((form) => saveAddress(type, form), flash);
  const title = type === "billing" ? "Billing address" : "Shipping address";
  return (
    <>
      <AccountNotices notices={notices} fromFlash={fromFlash} />
      <form method="post" noValidate onSubmit={submit} aria-busy={pending || undefined}>
        <h2>{title}</h2>
        <div className="woocommerce-address-fields">
          <div className="woocommerce-address-fields__field-wrapper">
            {FIELDS[type].map((field) => {
              const id = `${type}_${field.key}`;
              const auto = `section-${type} ${type} ${field.autoComplete}`;
              return (
                <p key={field.key} className={field.className} id={`${id}_field`}>
                  <label htmlFor={id} className="required_field">
                    {field.label}
                    <Required />
                  </label>
                  <span className="woocommerce-input-wrapper">
                    {field.input === "country" ? (
                      <select name={id} id={id} aria-required="true" autoComplete={auto} className="country_to_state country_to_state--single " defaultValue="ID">
                        <option value="ID">Indonesia</option>
                      </select>
                    ) : field.input === "state" ? (
                      <select name={id} id={id} className="state_select " aria-required="true" autoComplete={auto} data-placeholder="Select an option…" data-input-classes="" data-label="State / County" defaultValue={values.state || "BA"}>
                        <option value="">Select an option…</option>
                        {indonesiaStates.map(([code, name]) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input type={field.input} className="input-text " name={id} id={id} placeholder={field.placeholder ?? ""} defaultValue={values[field.key] ?? ""} aria-required="true" autoComplete={auto} />
                    )}
                  </span>
                </p>
              );
            })}
          </div>
          <p>
            <button type="submit" className="button" name="save_address" value="Save address" disabled={pending}>
              Save address
            </button>
            <input type="hidden" name="action" value="edit_address" />
          </p>
        </div>
      </form>
    </>
  );
}

export function EditAccountForm({ values, flash }: { values: { firstName: string; lastName: string; displayName: string; email: string }; flash: Notice[] }): ReactNode {
  const { notices, pending, submit, fromFlash } = useAccountForm(saveAccountDetails, flash);
  return (
    <>
      <AccountNotices notices={notices} fromFlash={fromFlash} />
      <form className="woocommerce-EditAccountForm edit-account" action="" method="post" onSubmit={submit} aria-busy={pending || undefined}>
        <p className="woocommerce-form-row woocommerce-form-row--first form-row form-row-first">
          <label htmlFor="account_first_name">
            First name
            <Required />
          </label>
          <input type="text" className="woocommerce-Input woocommerce-Input--text input-text" name="account_first_name" id="account_first_name" autoComplete="given-name" defaultValue={values.firstName} aria-required="true" />
        </p>
        <p className="woocommerce-form-row woocommerce-form-row--last form-row form-row-last">
          <label htmlFor="account_last_name">
            Last name
            <Required />
          </label>
          <input type="text" className="woocommerce-Input woocommerce-Input--text input-text" name="account_last_name" id="account_last_name" autoComplete="family-name" defaultValue={values.lastName} aria-required="true" />
        </p>
        <div className="clear" />
        <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
          <label htmlFor="account_display_name">
            Display name
            <Required />
          </label>
          <input type="text" className="woocommerce-Input woocommerce-Input--text input-text" name="account_display_name" id="account_display_name" aria-describedby="account_display_name_description" defaultValue={values.displayName} aria-required="true" />
          <span id="account_display_name_description">
            <em>This will be how your name will be displayed in the account section</em>
          </span>
        </p>
        <div className="clear" />
        <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
          <label htmlFor="account_email">
            Email address
            <Required />
          </label>
          <input type="email" className="woocommerce-Input woocommerce-Input--email input-text" name="account_email" id="account_email" autoComplete="email" defaultValue={values.email} aria-required="true" />
        </p>
        <fieldset>
          <legend>Password change</legend>
          <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
            <label htmlFor="password_current">Current password (leave blank to leave unchanged)</label>
            <PasswordInput className="woocommerce-Input woocommerce-Input--password input-text" name="password_current" id="password_current" autoComplete="current-password" />
          </p>
          <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
            <label htmlFor="password_1">New password (leave blank to leave unchanged)</label>
            <PasswordInput className="woocommerce-Input woocommerce-Input--password input-text" name="password_1" id="password_1" autoComplete="new-password" />
          </p>
          <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
            <label htmlFor="password_2">Confirm new password</label>
            <PasswordInput className="woocommerce-Input woocommerce-Input--password input-text" name="password_2" id="password_2" autoComplete="new-password" />
          </p>
        </fieldset>
        <div className="clear" />
        <p>
          <button type="submit" className="woocommerce-Button button" name="save_account_details" value="Save changes" disabled={pending}>
            Save changes
          </button>
          <input type="hidden" name="action" value="save_account_details" />
        </p>
      </form>
    </>
  );
}
