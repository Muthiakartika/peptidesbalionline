/**
 * My Account checks with WooCommerce 11.2.1's texts and order (class-wc-form-handler.php):
 *   * validateAccountDetails: "Account details" (save_account_details);
 *   * validateAddress: "Addresses" → billing / shipping (save_address), with the fields as live has them
 *     (the owner's Checkout Field Editor: billing "Full name", "WhatsApp Number", no last name or company).
 * Each returns the error messages; none means the form can be saved.
 */
import { indonesiaStates } from "@/lib/commerce/store-settings";

import { notice, type Notice } from "./notices";

/** WordPress's is_email(), simplified: something@domain.tld without spaces. */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
/** WC_Validation::is_phone_format(): only digits, spaces and # _ - + / ( ) . */
const isPhone = (value: string) => value.replace(/[\s#0-9_\-+/().]/g, "").length === 0;
/** WC_Validation::is_postcode() for Indonesia (no pattern of its own): letters, digits, spaces and "-". */
const isPostcode = (value: string) => value.replace(/[\s\-A-Za-z0-9]/g, "").trim().length === 0;

export type AccountDetailsInput = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** `emailTaken`: the e-mail belongs to another account. */
export function validateAccountDetails(input: AccountDetailsInput, current: { displayName: string; email: string }, emailTaken: boolean): Notice[] {
  const messages: Notice[] = [];
  const { firstName, lastName, displayName, email, currentPassword, newPassword, confirmPassword } = input;
  if (isEmail(displayName) && displayName !== current.displayName) {
    messages.push(notice.error("Display name cannot be changed to email address due to privacy concern."));
  }
  const required: [string, string][] = [
    [firstName, "First name"],
    [lastName, "Last name"],
    [displayName, "Display name"],
    [email, "Email address"],
  ];
  for (const [value, label] of required) {
    if (!value) messages.push(notice.error({ strong: label }, " is a required field."));
  }
  if (email) {
    if (!isEmail(email)) messages.push(notice.error("Please provide a valid email address."));
    else if (emailTaken && email.toLowerCase() !== current.email.toLowerCase()) messages.push(notice.error("This email address is already registered."));
  }
  if (currentPassword && !newPassword && !confirmPassword) messages.push(notice.error("Please fill out all password fields."));
  else if (newPassword && !currentPassword) messages.push(notice.error("Please enter your current password."));
  else if (newPassword && !confirmPassword) messages.push(notice.error("Please re-enter your password."));
  else if ((newPassword || confirmPassword) && newPassword !== confirmPassword) messages.push(notice.error("New passwords do not match."));
  return messages;
}

export type AddressType = "billing" | "shipping";
type FieldRule = "phone" | "email" | "postcode";
export type AddressField = { key: string; label: string; rule?: FieldRule };

/** The fields of each address form, in form order, as on live. Every one is required. */
export const addressFields: Record<AddressType, AddressField[]> = {
  billing: [
    { key: "first_name", label: "Full name" },
    { key: "phone", label: "WhatsApp Number", rule: "phone" },
    { key: "email", label: "Email address", rule: "email" },
    { key: "country", label: "Country / Region" },
    { key: "address_1", label: "Street address" },
    { key: "city", label: "Town / City" },
    { key: "state", label: "State / County" },
    { key: "postcode", label: "Postcode / ZIP", rule: "postcode" },
  ],
  shipping: [
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "country", label: "Country / Region" },
    { key: "address_1", label: "Street address" },
    { key: "city", label: "Town / City" },
    { key: "state", label: "State / County" },
    { key: "postcode", label: "Postcode / ZIP", rule: "postcode" },
    { key: "phone", label: "Phone", rule: "phone" },
  ],
};

export type AddressValues = Record<string, string>;

/** The values as WooCommerce stores them: e-mail in lower case, postcode in capitals (wc_format_postcode). */
export function normaliseAddress(type: AddressType, values: AddressValues): AddressValues {
  const out: AddressValues = {};
  for (const field of addressFields[type]) {
    let value = (values[field.key] ?? "").trim();
    if (field.rule === "email") value = value.toLowerCase();
    if (field.rule === "postcode") value = value.toUpperCase();
    out[field.key] = value;
  }
  return out;
}

export function validateAddress(type: AddressType, values: AddressValues): Notice[] {
  const messages: Notice[] = [];
  for (const field of addressFields[type]) {
    const value = values[field.key] ?? "";
    // save_address prints the label without bold for a missing field, and in bold for a wrong one.
    if (!value) {
      messages.push(notice.error(`${field.label} is a required field.`));
      continue;
    }
    if (field.rule === "postcode" && !isPostcode(value)) messages.push(notice.error("Please enter a valid postcode / ZIP."));
    if (field.rule === "phone" && !isPhone(value)) messages.push(notice.error({ strong: field.label }, " is not a valid phone number."));
    if (field.rule === "email" && !isEmail(value)) messages.push(notice.error({ strong: field.label }, " is not a valid email address."));
  }
  return messages;
}

/**
 * WooCommerce's formatted address for the Addresses page: the default format ({name}, {company},
 * {address_1}, {address_2}, {city}, {state}, {postcode}, {country}) without the country when it is the
 * store's (Indonesia), the province by its name, empty lines left out.
 */
export function formatAddress(values: AddressValues): string[] {
  const state = indonesiaStates.find(([code]) => code === values.state)?.[1] ?? values.state ?? "";
  const name = [values.first_name, values.last_name].filter(Boolean).join(" ");
  const lines = [name, values.company, values.address_1, values.address_2, values.city, state, values.postcode, values.country && values.country !== "ID" ? values.country : ""];
  return lines.map((line) => (line ?? "").trim()).filter(Boolean);
}
