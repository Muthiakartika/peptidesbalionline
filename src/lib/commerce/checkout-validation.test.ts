/** "Place order" checks with the live texts and order (WooCommerce + the owner's snippets). */
import { describe, expect, it } from "vitest";

import type { CartLine } from "./coupons";
import { validateCheckout, type CheckoutInput } from "./checkout-validation";
import { computeTotals } from "./totals";

const now = new Date("2026-11-06T10:00:00Z");
const line = (rupiah: number): CartLine => ({ key: "1:0", productId: 1, variationId: null, name: "KPV 10mg", categories: [], onSale: false, unitPrice: BigInt(rupiah) * 100n, quantity: 1 });
const complete: CheckoutInput = {
  deliveryAddress: "Jl. Pantai Berawa 1, Canggu",
  billing: { fullName: "Budi Santoso", phoneCountryCode: "ID|+62", phone: "812 3456 789", email: "budi@example.com", country: "ID", address1: "Jl. Pantai Berawa 1", city: "Canggu", state: "BA", postcode: "80361" },
  shipToDifferentAddress: false,
  shipping: { firstName: "", lastName: "", country: "ID", address1: "", city: "", state: "BA", postcode: "", phone: "" },
  deliveryDay: "2026-11-07",
  deliveryTime: "09:00-12:00",
  terms: true,
  paymentMethod: "sleeks_wise",
};

describe("checkout validation", () => {
  it("accepts a complete order", () => {
    expect(validateCheckout(complete, { totals: computeTotals({ lines: [line(1_200_000)] }), now })).toEqual([]);
  });

  it("lists the snippets' messages first, then WooCommerce's, then the card minimum", () => {
    const empty: CheckoutInput = {
      ...complete,
      deliveryAddress: "",
      billing: { ...complete.billing, fullName: "", phone: "", email: "budi@", address1: "", city: "", postcode: "" },
      deliveryDay: "",
      deliveryTime: "",
      terms: false,
      paymentMethod: "atlas_card",
    };
    const messages = validateCheckout(empty, { totals: computeTotals({ lines: [line(1_200_000)] }), now });
    expect(messages.map((m) => (m.strong ?? "") + m.text)).toEqual([
      "Please select a valid delivery day.",
      "Please select a valid delivery time slot.",
      "Please enter your delivery address.",
      "Billing Full name is a required field.",
      "Billing WhatsApp Number is a required field.",
      "Billing Email address is not a valid email address.",
      "Billing Street address is a required field.",
      "Billing Town / City is a required field.",
      "Billing Postcode / ZIP is a required field.",
      "Please read and accept the terms and conditions to proceed with your order.",
      "Card payment requires a minimum order of Rp2,000,000.",
    ]);
  });

  it("refuses COD under Rp 2,500,000, odd phone numbers, unknown methods, and checks the other address", () => {
    const totals = computeTotals({ lines: [line(1_200_000)] });
    expect(validateCheckout({ ...complete, paymentMethod: "cod" }, { totals, now })).toEqual([
      { text: "Cash on Delivery is available only for orders above Rp2,500,000. Please select another payment method." },
    ]);
    expect(validateCheckout({ ...complete, billing: { ...complete.billing, phone: "call me" } }, { totals, now })).toEqual([{ strong: "Billing WhatsApp Number", text: " is not a valid phone number." }]);
    expect(validateCheckout({ ...complete, paymentMethod: "paypal" }, { totals, now })).toEqual([{ text: "Invalid payment method." }]);
    const shipping = validateCheckout({ ...complete, shipToDifferentAddress: true }, { totals, now }).map((m) => m.strong);
    expect(shipping).toEqual(["Shipping First name", "Shipping Last name", "Shipping Street address", "Shipping Town / City", "Shipping Postcode / ZIP", "Shipping Phone"]);
  });

  it("accepts every country code of the live list, and refuses others", () => {
    const totals = computeTotals({ lines: [line(1_200_000)] });
    expect(validateCheckout({ ...complete, billing: { ...complete.billing, phoneCountryCode: "AU|+61" } }, { totals, now })).toEqual([]);
    expect(validateCheckout({ ...complete, billing: { ...complete.billing, phoneCountryCode: "XX|+0" } }, { totals, now })).toEqual([{ text: "Please select a country code for your WhatsApp number." }]);
  });

  it("puts the cart's own errors (out of stock) first", () => {
    const messages = validateCheckout(complete, { totals: computeTotals({ lines: [line(1_200_000)] }), cartErrors: ['Sorry, "KPV 10mg" is not in stock.'], now });
    expect(messages[0]).toEqual({ text: 'Sorry, "KPV 10mg" is not in stock.' });
  });
});
