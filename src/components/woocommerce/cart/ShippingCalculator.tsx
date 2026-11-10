"use client";

/**
 * "Change address" under the shipping line of the cart totals (WooCommerce's shipping calculator, markup
 * as on live): the link opens the form; "Update" saves the destination (setShippingDestination) and the
 * page is rendered again with "Shipping costs updated." and the new "Shipping to …".
 * Only Indonesia is offered, as on live.
 */
import { useState, useTransition } from "react";

import { setShippingDestination } from "@/app/(store)/cart/actions";
import type { Destination } from "@/lib/commerce/cart-cookie";
import { indonesiaStates, shipping } from "@/lib/commerce/store-settings";
import { announceCartChange } from "@/lib/commerce/useCartCount";

import { useCartNotices } from "./CartControls";

export function ShippingCalculator({ destination }: { destination?: Destination }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { show } = useCartNotices();
  return (
    <form
      className="woocommerce-shipping-calculator"
      action="/cart/"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await setShippingDestination(String(data.get("calc_shipping_country")), String(data.get("calc_shipping_state")), String(data.get("calc_shipping_city")), String(data.get("calc_shipping_postcode")));
          announceCartChange();
          if (result.ok) {
            setOpen(false);
            show({ kind: "message", text: "Shipping costs updated." });
          } else show({ kind: "error", text: result.error });
        });
      }}
    >
      <a
        href="#"
        className="shipping-calculator-button"
        aria-expanded={open}
        aria-controls="shipping-calculator-form"
        role="button"
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        Change address
      </a>
      <section className="shipping-calculator-form" id="shipping-calculator-form" style={open ? undefined : { display: "none" }}>
        <p className="form-row form-row-wide validate-required" id="calc_shipping_country_field">
          <label htmlFor="calc_shipping_country">
            Country / region&nbsp;
            <span className="required" aria-hidden="true">
              *
            </span>
          </label>
          <select name="calc_shipping_country" id="calc_shipping_country" className="country_to_state country_select" defaultValue="ID">
            <option value="default">Select a country / region…</option>
            <option value="ID">Indonesia</option>
          </select>
        </p>
        <p className="form-row form-row-wide validate-required" id="calc_shipping_state_field">
          <span>
            <label htmlFor="calc_shipping_state">
              State / County&nbsp;
              <span className="required" aria-hidden="true">
                *
              </span>
            </label>
            <select name="calc_shipping_state" className="state_select" id="calc_shipping_state" defaultValue={destination?.state ?? shipping.defaultState}>
              <option value="">Select an option…</option>
              {indonesiaStates.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </span>
        </p>
        <p className="form-row form-row-wide validate-required" id="calc_shipping_city_field">
          <label htmlFor="calc_shipping_city">
            City:&nbsp;
            <span className="required" aria-hidden="true">
              *
            </span>
          </label>
          <input type="text" className="input-text" defaultValue={destination?.city ?? ""} name="calc_shipping_city" id="calc_shipping_city" />
        </p>
        <p className="form-row form-row-wide validate-required" id="calc_shipping_postcode_field">
          <label htmlFor="calc_shipping_postcode">
            Postcode / ZIP:&nbsp;
            <span className="required" aria-hidden="true">
              *
            </span>
          </label>
          <input type="text" className="input-text" defaultValue={destination?.postcode ?? ""} name="calc_shipping_postcode" id="calc_shipping_postcode" />
        </p>
        <p>
          <button type="submit" name="calc_shipping" value="1" className="button" disabled={pending}>
            Update
          </button>
        </p>
      </section>
    </form>
  );
}
