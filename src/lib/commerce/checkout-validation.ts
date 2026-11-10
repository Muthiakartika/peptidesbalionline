/**
 * "Place order" checks, with the live texts and in the order WooCommerce collects them
 * (WC_Checkout::process_checkout):
 *   1. the cart's own errors (out of stock…);
 *   2. the owner's snippets on "woocommerce_checkout_process", by snippet ID (WPCode's load order, as far as
 *      known): delivery day and time slot (6140), delivery address (6865), COD minimum (8698), WhatsApp
 *      country code (8811);
 *   3. WooCommerce's field checks in form order (billing, then shipping if "Ship to a different
 *      address?"), "<strong>Billing Full name</strong> is a required field." and the like, then the terms
 *      and the payment method;
 *   4. the card minimum (snippet 11168, "woocommerce_after_checkout_validation").
 * A message is { strong?, text }: the bold part as WooCommerce prints it, then the rest.
 */
import { deliveryDayOptions, deliveryTimeOptions } from "./delivery";
import { phoneCountryCodes } from "./phone-country-codes";
import { indonesiaStates, paymentMethods, type PaymentMethodId } from "./store-settings";
import type { Totals } from "./totals";

export type CheckoutMessage = { strong?: string; text: string };

export type CheckoutAddress = { country: string; address1: string; city: string; state: string; postcode: string };

export type CheckoutInput = {
  deliveryAddress: string;
  billing: CheckoutAddress & { fullName: string; phoneCountryCode: string; phone: string; email: string };
  shipToDifferentAddress: boolean;
  shipping: CheckoutAddress & { firstName: string; lastName: string; phone: string };
  deliveryDay: string;
  deliveryTime: string;
  terms: boolean;
  paymentMethod: string;
};

const required = (label: string): CheckoutMessage => ({ strong: label, text: " is a required field." });
/** WordPress's is_email(), simplified: something@domain.tld without spaces. */
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
/** WC_Validation::is_phone(): only digits, spaces and # _ - + / ( ) . */
const isPhone = (value: string) => value.replace(/[\s#0-9_\-+/().]/g, "").length === 0;

function addressMessages(prefix: "Billing" | "Shipping", address: CheckoutAddress): CheckoutMessage[] {
  const messages: CheckoutMessage[] = [];
  if (!address.country) messages.push(required(`${prefix} Country / Region`));
  else if (address.country !== "ID") messages.push({ strong: `${prefix} Country / Region`, text: " is not valid." });
  if (!address.address1.trim()) messages.push(required(`${prefix} Street address`));
  if (!address.city.trim()) messages.push(required(`${prefix} Town / City`));
  if (!address.state) messages.push(required(`${prefix} State / County`));
  else if (!indonesiaStates.some(([code]) => code === address.state)) {
    messages.push({ strong: `${prefix} State / County`, text: ` is not valid. Please enter one of the following: ${indonesiaStates.map(([, name]) => name).join(", ")}` });
  }
  if (!address.postcode.trim()) messages.push(required(`${prefix} Postcode / ZIP`));
  return messages;
}

export function validateCheckout(input: CheckoutInput, { totals, cartErrors = [], now = new Date() }: { totals: Totals; cartErrors?: string[]; now?: Date }): CheckoutMessage[] {
  const messages: CheckoutMessage[] = cartErrors.map((text) => ({ text }));

  // 2. The owner's snippets.
  if (!deliveryDayOptions(now).some((o) => o.value && o.value === input.deliveryDay)) messages.push({ text: "Please select a valid delivery day." });
  if (!deliveryTimeOptions().some((o) => o.value && o.value === input.deliveryTime)) messages.push({ text: "Please select a valid delivery time slot." });
  if (!input.deliveryAddress.trim()) messages.push({ text: "Please enter your delivery address." });
  const cod = totals.paymentOptions.find((o) => o.id === "cod");
  if (input.paymentMethod === "cod" && cod && !cod.available) messages.push({ text: cod.locked!.error });
  if (!phoneCountryCodes.some(([value]) => value === input.billing.phoneCountryCode)) messages.push({ text: "Please select a country code for your WhatsApp number." });

  // 3. WooCommerce's checks, in form order.
  const b = input.billing;
  if (!b.fullName.trim()) messages.push(required("Billing Full name"));
  if (!b.phoneCountryCode) messages.push(required("Billing Country Code"));
  if (!b.phone.trim()) messages.push(required("Billing WhatsApp Number"));
  else if (!isPhone(b.phone)) messages.push({ strong: "Billing WhatsApp Number", text: " is not a valid phone number." });
  if (!b.email.trim()) messages.push(required("Billing Email address"));
  else if (!isEmail(b.email.trim())) messages.push({ strong: "Billing Email address", text: " is not a valid email address." });
  messages.push(...addressMessages("Billing", b));
  if (input.shipToDifferentAddress) {
    const s = input.shipping;
    if (!s.firstName.trim()) messages.push(required("Shipping First name"));
    if (!s.lastName.trim()) messages.push(required("Shipping Last name"));
    messages.push(...addressMessages("Shipping", s));
    if (!s.phone.trim()) messages.push(required("Shipping Phone"));
    else if (!isPhone(s.phone)) messages.push({ strong: "Shipping Phone", text: " is not a valid phone number." });
  }
  if (!input.terms) messages.push({ text: "Please read and accept the terms and conditions to proceed with your order." });
  const method = paymentMethods.find((m) => m.id === input.paymentMethod);
  if (!method) messages.push({ text: "Invalid payment method." });

  // 4. The card minimum.
  const card = totals.paymentOptions.find((o) => o.id === "atlas_card");
  if (input.paymentMethod === "atlas_card" && card && !card.available) messages.push({ text: card.locked!.error });
  return messages;
}

export const isPaymentMethodId = (value: string): value is PaymentMethodId => paymentMethods.some((m) => m.id === value);
