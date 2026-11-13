"use client";

/**
 * The checkout form, markup as on the live site (docs/audit/visual-reference/markup/checkout-*.html):
 * WooCommerce's billing / shipping fields as the owner set them up (Checkout Field Editor), the owner's
 * "Delivery location" box, WhatsApp country code, delivery slot, coupon box, payment methods with the
 * card / COD locks and the card fee, the terms checkbox and the WhatsApp link.
 *
 * The totals are worked out here with the same rules as the server (src/lib/commerce/totals.ts) so they
 * follow the payment method at once; "Place order" checks everything again on the server.
 * The delivery map (DeliveryMap.tsx) appears once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (Q-33, docs/setup/google-maps.md).
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";

import { removeCartCoupon } from "@/app/(store)/cart/actions";
import { applyCheckoutCoupon, placeOrder } from "@/app/(store)/checkout/actions";
import { logIn } from "@/app/(store)/my-account/actions";
import { NoticeList } from "@/components/woocommerce/account/AccountNotices";
import type { Notice } from "@/lib/account/notices";
import { RemoveCouponLink } from "@/components/woocommerce/cart/CartControls";
import { CartAmount, CartPrice } from "@/components/woocommerce/cart/CartPrice";
import { CouponRow } from "@/components/woocommerce/cart/CouponRow";
import { OfferCard, OfferRow } from "@/components/woocommerce/OfferCard";
import { formatUsd } from "@/lib/catalog/usd";
import type { CheckoutMessage } from "@/lib/commerce/checkout-validation";
import { couponFromData, type CartLine, type CouponData } from "@/lib/commerce/coupons";
import type { DeliveryOption } from "@/lib/commerce/delivery";
import { phoneCountryCodes } from "@/lib/commerce/phone-country-codes";
import { idrPerUsd, indonesiaStates, type PaymentMethodId } from "@/lib/commerce/store-settings";
import { PAYMENT_DETAILS } from "@/lib/commerce/payment-details";
import { CURRENT_OFFER } from "@/lib/commerce/offers";
import { computeTotals, percentOf } from "@/lib/commerce/totals";
import { useHydrated } from "@/lib/useHydrated";

import { ADDRESS_STATUS } from "@/lib/commerce/delivery-address";

import { DeliveryMap, type DeliveryPoint, type StatusTone } from "./DeliveryMap";

export type ReviewLine = Omit<CartLine, "unitPrice"> & { unitPrice: string; options: { label: string; value: string }[] };

/**
 * The Google Maps key of the delivery map (Q-33, docs/setup/google-maps.md): a browser key, public by nature, written into the
 * build. Without it the map isn't shown and the typed address is what the order keeps.
 */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** "(~$8.48)" as the owner's fee snippet prints it: number_format with 2 decimals. */
const usdPlain = (minor: bigint) => `(~$${(Number(minor) / 100 / idrPerUsd).toFixed(2)})`;

function Field({
  id,
  label,
  required = true,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <p className={className} id={`${id}_field`}>
      <label htmlFor={id} className={required ? "required_field" : ""}>
        {label}&nbsp;
        {required ? (
          <span className="required" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="optional">(optional)</span>
        )}
      </label>
      <span className="woocommerce-input-wrapper">{children}</span>
    </p>
  );
}

function StateSelect({ id, name, autoComplete, value = "BA" }: { id: string; name: string; autoComplete: string; value?: string }) {
  return (
    <select name={name} id={id} className="state_select" aria-required="true" autoComplete={autoComplete} defaultValue={value || "BA"} data-placeholder="Select an option…">
      <option value="">Select an option…</option>
      {indonesiaStates.map(([code, title]) => (
        <option key={code} value={code}>
          {title}
        </option>
      ))}
    </select>
  );
}

/** A logged-in customer: the saved billing address fills the form, and the login and "Create an account?" go. */
export type CheckoutCustomer = { billing: Record<string, string> };

/**
 * The owner's coupon box opens and closes with jQuery's slideDown / slideUp (200 ms, "swing"): the same
 * height animation here.
 */
function slide(element: HTMLElement | null, open: boolean) {
  if (!element) return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.style.display = "block";
  const height = `${element.scrollHeight}px`;
  const animation = element.animate(
    [
      { height: open ? "0px" : height, overflow: "hidden" },
      { height: open ? height : "0px", overflow: "hidden" },
    ],
    { duration: 200, easing: "cubic-bezier(0.37, 0, 0.63, 1)" },
  );
  animation.onfinish = () => {
    element.style.display = open ? "block" : "none";
  };
}

export function CheckoutForm({
  lines,
  coupons = [],
  deliveryDays,
  deliveryTimes,
  whatsappHref,
  customer = null,
}: {
  lines: ReviewLine[];
  /** The applied coupons still valid for this cart (their rules only). */
  coupons?: CouponData[];
  deliveryDays: DeliveryOption[];
  deliveryTimes: DeliveryOption[];
  whatsappHref: string;
  customer?: CheckoutCustomer | null;
}) {
  const saved = customer?.billing ?? {};
  const [paymentId, setPaymentId] = useState<PaymentMethodId | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [shipElsewhere, setShipElsewhere] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState<{ ok: boolean; message: string } | null>(null);
  const [addressStatus, setAddressStatus] = useState<{ text: string; tone?: StatusTone }>({ text: "" });
  const showAddressStatus = useCallback((text: string, tone?: StatusTone) => setAddressStatus({ text, tone }), []);
  // The point chosen on the map (coordinates only with a map), Google's or the typed address, and the map's
  // "Find on Map" action once it's ready.
  const [deliveryPoint, setDeliveryPoint] = useState<DeliveryPoint>({ lat: "", lng: "", address: "" });
  const updateDeliveryPoint = useCallback((point: Partial<DeliveryPoint>) => setDeliveryPoint((current) => ({ ...current, ...point })), []);
  const findOnMap = useRef<((address: string) => void) | null>(null);
  /** As live: the delivery address is also the billing street address (live's input / blur handlers). */
  const keepTypedAddress = (address: string, announce: boolean) => {
    const street = document.getElementById("billing_address_1") as HTMLInputElement | null;
    if (street) {
      street.value = address;
      if (announce) street.dispatchEvent(new Event("change", { bubbles: true }));
    }
    updateDeliveryPoint({ address });
  };
  /** "Find on Map" (and Enter in the address box): on the map when there is one, else the typed address is kept. */
  const findAddress = () => {
    const typed = (document.getElementById("atlas_delivery_address") as HTMLInputElement | null)?.value.trim() ?? "";
    if (findOnMap.current) return findOnMap.current(typed);
    if (!typed) return showAddressStatus(ADDRESS_STATUS.empty, "error");
    keepTypedAddress(typed, true);
    showAddressStatus(ADDRESS_STATUS.saved, "success");
  };
  const [messages, setMessages] = useState<CheckoutMessage[]>([]);
  const [placing, startPlacing] = useTransition();
  const [applying, startApplying] = useTransition();
  const [loginNotices, setLoginNotices] = useState<Notice[]>([]);
  const [loggingIn, startLogin] = useTransition();
  const hydrated = useHydrated();
  const [showPassword, setShowPassword] = useState(false);
  const couponInput = useRef<HTMLInputElement>(null);
  const couponContent = useRef<HTMLDivElement>(null);
  // checkout.js: after a coupon is applied, update_order_review's notices go first in the form
  // (woocommerce-NoticeGroup-updateOrderReview, newest first); after "[Remove]", its notice goes just before the form.
  const [updateNotices, setUpdateNotices] = useState<{ id: number; text: string }[]>([]);
  const [beforeForm, setBeforeForm] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, startRemoving] = useTransition();
  const noticeId = useRef(0);
  const noticeGroup = useRef<HTMLDivElement>(null);
  // After "Place order", as WooCommerce's scroll_to_notices: the messages 100px below the top.
  const [answered, setAnswered] = useState(0);
  useEffect(() => {
    const group = noticeGroup.current;
    if (answered && group) window.scrollTo({ top: group.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
  }, [answered]);

  const cartLines: CartLine[] = useMemo(() => lines.map((line) => ({ ...line, unitPrice: BigInt(line.unitPrice) })), [lines]);
  const appliedCoupons = useMemo(() => coupons.map(couponFromData), [coupons]);
  const totals = computeTotals({ lines: cartLines, coupons: appliedCoupons, paymentId, preselectPayment: true, offer: CURRENT_OFFER });

  /** The owner's "Apply" (snippet 6479): its own texts, WooCommerce's notice at the top once it worked. */
  const applyCoupon = () => {
    const code = couponInput.current?.value.trim() ?? "";
    if (!code) return setCoupon({ ok: false, message: "Please enter a coupon or affiliate code." });
    setCoupon(null);
    startApplying(async () => {
      const result = await applyCheckoutCoupon(code);
      setCoupon({ ok: result.ok, message: result.message });
      if (!result.ok) return;
      if (couponInput.current) couponInput.current.value = "";
      if (result.notice) {
        setMessages([]);
        setUpdateNotices((list) => [{ id: ++noticeId.current, text: result.notice! }, ...list]);
      }
    });
  };

  /** checkout.js remove_coupon: every notice goes, "Coupon has been removed." before the form, totals again. */
  const removeCoupon = (code: string) =>
    startRemoving(async () => {
      const result = await removeCartCoupon(code);
      setMessages([]);
      setUpdateNotices([]);
      setLoginNotices([]);
      setBeforeForm({ ok: result.ok, text: result.notice });
    });
  const chosen = totals.payment?.id ?? null;
  const cardState = totals.paymentOptions.find((option) => option.id === "atlas_card");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "");
    startPlacing(async () => {
      const result = await placeOrder({
        deliveryAddress: value("atlas_delivery_address"),
        billing: {
          fullName: value("billing_first_name"),
          phoneCountryCode: value("billing_phone_country_code"),
          phone: value("billing_phone"),
          email: value("billing_email"),
          country: value("billing_country"),
          address1: value("billing_address_1"),
          city: value("billing_city"),
          state: value("billing_state"),
          postcode: value("billing_postcode"),
        },
        shipToDifferentAddress: data.get("ship_to_different_address") === "1",
        shipping: {
          firstName: value("shipping_first_name"),
          lastName: value("shipping_last_name"),
          country: value("shipping_country"),
          address1: value("shipping_address_1"),
          city: value("shipping_city"),
          state: value("shipping_state"),
          postcode: value("shipping_postcode"),
          phone: value("shipping_phone"),
        },
        deliveryDay: value("delivery_day"),
        deliveryTime: value("delivery_time_slot"),
        terms: data.get("terms") === "on",
        paymentMethod: value("payment_method"),
      }, {
        createAccount: data.get("createaccount") === "1",
        notes: value("order_comments"),
        location: { lat: value("atlas_delivery_latitude"), lng: value("atlas_delivery_longitude"), address: value("atlas_google_formatted_address") },
      });
      // Saved: the thank-you page (or WhatsApp for IDR Account), a full load as WooCommerce's redirect.
      if (result.ok) return window.location.assign(result.redirect);
      // checkout.js submit_error: the earlier notices go, the new ones come.
      setUpdateNotices([]);
      setBeforeForm(null);
      setMessages(result.messages);
      setAnswered((count) => count + 1);
    });
  };

  return (
    <>
      <div className="woocommerce-notices-wrapper">
        <NoticeList notices={loginNotices} />
      </div>
      {customer ? null : (
        <>
      <div className="woocommerce-form-login-toggle">
        <div className="woocommerce-info" role="status">
          Returning customer?{" "}
          <a
            href="#"
            className="showlogin"
            onClick={(event) => {
              event.preventDefault();
              setShowLogin((open) => !open);
            }}
          >
            Click here to login
          </a>
        </div>
      </div>
      <form
        id="customer_login"
        method="post"
        className="login woocommerce-form woocommerce-form-login hidden-form"
        style={showLogin ? undefined : { display: "none" }}
        onSubmit={(event) => {
          event.preventDefault();
          // WooCommerce's checkout login: back to the checkout once logged in, errors at the top of the page.
          const data = new FormData(event.currentTarget);
          data.set("redirect", "/checkout/");
          startLogin(async () => {
            const result = await logIn(data);
            if (result.redirect) return window.location.assign(result.redirect);
            setLoginNotices(result.notices);
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        }}
        aria-busy={loggingIn || undefined}
      >
        <p>If you have shopped with us before, please enter your details below. If you are a new customer, please proceed to the Billing section.</p>
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
          <span className={`password-input${showPassword ? " show-password-input" : ""}`}>
            <input className="woocommerce-Input woocommerce-Input--text input-text" type={showPassword ? "text" : "password"} name="password" id="password" autoComplete="current-password" />
            <button type="button" className={`show-password-input${showPassword ? " display-password" : ""}`} aria-label={showPassword ? "Hide password" : "Show password"} aria-describedby="password" onClick={() => setShowPassword((shown) => !shown)} />
          </span>
        </p>
        <p className="form-row form-row-btn">
          <button type="submit" className="button woocommerce-button woocommerce-form-login__submit" name="login" value="Log in" disabled={!hydrated}>
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
      )}
      <div className="woocommerce-notices-wrapper" />
      {beforeForm ? (
        beforeForm.ok ? (
          <div className="woocommerce-message" role="alert">
            {beforeForm.text}
          </div>
        ) : (
          <ul className="woocommerce-error" role="alert">
            <li>{beforeForm.text}</li>
          </ul>
        )
      ) : null}

      <form name="checkout" method="post" className="checkout woocommerce-checkout" action="/checkout/" encType="multipart/form-data" aria-label="Checkout" onSubmit={submit} noValidate>
        {updateNotices.map((notice) => (
          <div key={notice.id} className="woocommerce-NoticeGroup woocommerce-NoticeGroup-updateOrderReview">
            <div className="woocommerce-message" role="alert">
              {notice.text}
            </div>
          </div>
        ))}
        {messages.length ? (
          <div ref={noticeGroup} className="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">
            <ul className="woocommerce-error" role="alert">
              {messages.map((message, index) => (
                <li key={index}>
                  {message.strong ? <strong>{message.strong}</strong> : null}
                  {message.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="customer-details" id="customer_details">
          <div className="woocommerce-billing-fields">
            <h3>Billing details</h3>
            <div className="atlas-location-box">
              <div className="atlas-location-heading">
                <span className="atlas-location-kicker"> DELIVERY LOCATION </span>
                <h3> Where should we deliver? </h3>
                <p> Enter a street address, Plus Code, villa, hotel or business. You don&apos;t need to enter a villa or hotel name if you only know the street address. </p>
              </div>
              <div className="atlas-address-search-wrap">
                <label htmlFor="atlas_delivery_address">
                  {" "}
                  Delivery address <span className="required">*</span>{" "}
                </label>
                <div className="atlas-address-input-wrap">
                  <span className="atlas-address-icon"> ⌖ </span>
                  <input
                    type="text"
                    id="atlas_delivery_address"
                    name="atlas_delivery_address"
                    className="atlas-delivery-address"
                    placeholder="Street address, Plus Code or place..."
                    autoComplete="off"
                    onInput={(event) => {
                      const address = event.currentTarget.value.trim();
                      keepTypedAddress(address, false);
                      showAddressStatus(address ? (MAPS_KEY ? ADDRESS_STATUS.typing : "") : "");
                    }}
                    onBlur={(event) => {
                      const address = event.currentTarget.value.trim();
                      if (address) keepTypedAddress(address, true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      // Enter searches the address (or picks the highlighted suggestion); it never sends the checkout.
                      event.preventDefault();
                      if (!document.querySelector(".pac-container .pac-item-selected")) findAddress();
                    }}
                  />
                </div>
                <button type="button" id="atlas-find-address" className="atlas-find-address-button" onClick={findAddress}>
                  {" "}
                  {MAPS_KEY ? "Find on Map" : "Use this address"}{" "}
                </button>
                <div id="atlas-address-status" className={`atlas-address-status${addressStatus.tone ? ` is-${addressStatus.tone}` : ""}`} aria-live="polite">
                  {addressStatus.text}
                </div>
              </div>
              {/* Live's Google map (Q-33). Without a key nothing is shown: an empty map box looked broken. */}
              {MAPS_KEY ? <DeliveryMap apiKey={MAPS_KEY} inputId="atlas_delivery_address" onLocation={updateDeliveryPoint} onStatus={showAddressStatus} findRef={findOnMap} /> : null}
              <input type="hidden" name="atlas_delivery_latitude" id="atlas_delivery_latitude" value={deliveryPoint.lat} />
              <input type="hidden" name="atlas_delivery_longitude" id="atlas_delivery_longitude" value={deliveryPoint.lng} />
              <input type="hidden" name="atlas_google_formatted_address" id="atlas_google_formatted_address" value={deliveryPoint.address} />
            </div>
            <div className="woocommerce-billing-fields__field-wrapper">
              <Field id="billing_first_name" label="Full name" className="form-row form-row-wide thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required">
                <input type="text" className="input-text " name="billing_first_name" id="billing_first_name" defaultValue={saved.first_name} aria-required="true" autoComplete="section-billing billing given-name" />
              </Field>
              <Field id="billing_phone_country_code" label="Country Code" className="form-row form-row-first atlas-phone-code-field validate-required">
                <select name="billing_phone_country_code" id="billing_phone_country_code" className="select atlas-phone-code-select" aria-required="true" defaultValue={saved.phone_country_code || "ID|+62"}>
                  {phoneCountryCodes.map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="billing_phone" label="WhatsApp Number" className="form-row form-row-last atlas-phone-number-field validate-required validate-phone">
                <input type="tel" className="input-text " name="billing_phone" id="billing_phone" defaultValue={saved.phone} aria-required="true" autoComplete="section-billing billing tel" />
              </Field>
              <Field id="billing_email" label="Email address" className="form-row form-row-wide thwcfd-required thwcfd-field-wrapper thwcfd-field-email validate-required validate-email">
                <input type="email" className="input-text " name="billing_email" id="billing_email" defaultValue={saved.email} aria-required="true" autoComplete="section-billing billing email" aria-describedby="billing_email-description" />
                <span className="description" id="billing_email-description" aria-hidden="true">
                  We&apos;ll save your cart and may email you a reminder if you don&apos;t finish your order.
                </span>
              </Field>
              <Field id="billing_country" label="Country / Region" className="form-row form-row-wide address-field update_totals_on_change thwcfd-required thwcfd-field-wrapper thwcfd-field-country validate-required">
                <select name="billing_country" id="billing_country" aria-required="true" autoComplete="section-billing billing country" className="country_to_state country_to_state--single " defaultValue="ID">
                  <option value="ID">Indonesia</option>
                </select>
              </Field>
              <Field id="billing_address_1" label="Street address" className="form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required">
                <input type="text" className="input-text " name="billing_address_1" id="billing_address_1" placeholder="House number and street name" defaultValue={saved.address_1} aria-required="true" autoComplete="section-billing billing address-line1" />
              </Field>
              <Field id="billing_city" label="Town / City" className="form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required">
                <input type="text" className="input-text " name="billing_city" id="billing_city" defaultValue={saved.city} aria-required="true" autoComplete="section-billing billing address-level2" />
              </Field>
              <Field id="billing_state" label="State / County" className="form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-state validate-required validate-state">
                <StateSelect id="billing_state" name="billing_state" autoComplete="section-billing billing address-level1" value={saved.state} />
              </Field>
              <Field id="billing_postcode" label="Postcode / ZIP" className="form-row form-row-wide address-field thwcfd-required thwcfd-field-wrapper thwcfd-field-text validate-required validate-postcode">
                <input type="text" className="input-text " name="billing_postcode" id="billing_postcode" defaultValue={saved.postcode} aria-required="true" autoComplete="section-billing billing postal-code" />
              </Field>
            </div>
          </div>

          {customer ? null : (
            <div className="woocommerce-account-fields">
              <p className="form-row form-row-wide create-account">
                <label className="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
                  <input className="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox" id="createaccount" type="checkbox" name="createaccount" value="1" /> <span>Create an account?</span>
                </label>
              </p>
            </div>
          )}

          <div className="woocommerce-shipping-fields">
            <h3 id="ship-to-different-address">
              <label className="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
                <input
                  id="ship-to-different-address-checkbox"
                  className="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox"
                  type="checkbox"
                  name="ship_to_different_address"
                  value="1"
                  checked={shipElsewhere}
                  onChange={(event) => setShipElsewhere(event.target.checked)}
                />{" "}
                <span>Ship to a different address?</span>
              </label>
            </h3>
            <div className="shipping_address" style={shipElsewhere ? undefined : { display: "none" }}>
              <div className="woocommerce-shipping-fields__field-wrapper">
                <Field id="shipping_first_name" label="First name" className="form-row form-row-first validate-required">
                  <input type="text" className="input-text " name="shipping_first_name" id="shipping_first_name" aria-required="true" autoComplete="section-shipping shipping given-name" />
                </Field>
                <Field id="shipping_last_name" label="Last name" className="form-row form-row-last validate-required">
                  <input type="text" className="input-text " name="shipping_last_name" id="shipping_last_name" aria-required="true" autoComplete="section-shipping shipping family-name" />
                </Field>
                <Field id="shipping_country" label="Country / Region" className="form-row form-row-wide address-field update_totals_on_change validate-required">
                  <select name="shipping_country" id="shipping_country" aria-required="true" autoComplete="section-shipping shipping country" className="country_to_state country_to_state--single " defaultValue="ID">
                    <option value="ID">Indonesia</option>
                  </select>
                </Field>
                <Field id="shipping_address_1" label="Street address" className="form-row form-row-wide address-field validate-required">
                  <input type="text" className="input-text " name="shipping_address_1" id="shipping_address_1" placeholder="House number and street name" aria-required="true" autoComplete="section-shipping shipping address-line1" />
                </Field>
                <Field id="shipping_city" label="Town / City" className="form-row form-row-wide address-field validate-required">
                  <input type="text" className="input-text " name="shipping_city" id="shipping_city" aria-required="true" autoComplete="section-shipping shipping address-level2" />
                </Field>
                <Field id="shipping_state" label="State / County" className="form-row form-row-wide address-field validate-required validate-state">
                  <StateSelect id="shipping_state" name="shipping_state" autoComplete="section-shipping shipping address-level1" />
                </Field>
                <Field id="shipping_postcode" label="Postcode / ZIP" className="form-row form-row-wide address-field validate-required validate-postcode">
                  <input type="text" className="input-text " name="shipping_postcode" id="shipping_postcode" aria-required="true" autoComplete="section-shipping shipping postal-code" />
                </Field>
                <Field id="shipping_phone" label="Phone" className="form-row form-row-wide validate-required validate-phone">
                  <input type="tel" className="input-text " name="shipping_phone" id="shipping_phone" aria-required="true" autoComplete="section-shipping shipping tel" />
                </Field>
              </div>
            </div>
          </div>

          <div className="woocommerce-additional-fields">
            <div className="sleeks-delivery-box">
              <h3>
                {" "}
                Delivery slot <span className="required">*</span>{" "}
              </h3>
              <p className="delivery-slot-description"> Choose when you&apos;d like your order delivered: </p>
              <div className="delivery-slot-row">
                <p className="form-row form-row-wide delivery-day-field validate-required" id="delivery_day_field">
                  <span className="woocommerce-input-wrapper">
                    <select name="delivery_day" id="delivery_day" className="select delivery-slot-select" aria-required="true" aria-label="Delivery day" data-allow_clear="true" data-placeholder="Choose a delivery day" defaultValue="">
                      {deliveryDays.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </p>
                <p className="form-row form-row-wide delivery-time-field validate-required" id="delivery_time_slot_field">
                  <span className="woocommerce-input-wrapper">
                    <select name="delivery_time_slot" id="delivery_time_slot" className="select delivery-slot-select" aria-required="true" aria-label="Delivery time" data-allow_clear="true" data-placeholder="Choose a time" defaultValue="">
                      {deliveryTimes.map((time) => (
                        <option key={time.value} value={time.value}>
                          {time.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </p>
              </div>
              <p className="delivery-slot-help"> Please be available during your selected delivery slot. </p>
            </div>
            <h3>Additional information</h3>
            <div className="woocommerce-additional-fields__field-wrapper">
              <Field id="order_comments" label="Delivery Instructions" required={false} className="form-row notes thwcfd-field-wrapper thwcfd-field-textarea">
                <textarea name="order_comments" className="input-text " id="order_comments" placeholder="Notes about your order, e.g. special notes for delivery." rows={2} cols={5} />
              </Field>
            </div>
          </div>
        </div>

        <div className="checkout-order-review">
          <h3 id="order_review_heading">Your order</h3>
          <OfferCard state={totals.offer} />
          <div id="order_review" className="woocommerce-checkout-review-order">
            <div className="wd-table-wrapper">
              <table className="shop_table woocommerce-checkout-review-order-table">
                <thead>
                  <tr>
                    <th className="product-name">Product</th>
                    <th className="product-total">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key} className="cart_item">
                      <td className="product-name">
                        {line.name}&nbsp; <strong className="product-quantity">×&nbsp;{line.quantity}</strong>
                        {line.options.length ? (
                          <ul className="variation">
                            {line.options.map((option) => (
                              <li key={option.label} className={`variation-${option.label.replace(/\s+/g, "")}`}>
                                <span className="item-variation-name">{option.label}:</span>{" "}
                                <span className="item-variation-value">
                                  <p>{option.value}</p>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td className="product-total">
                        <CartPrice value={BigInt(line.unitPrice) * BigInt(line.quantity)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="cart-subtotal">
                    <th>Subtotal</th>
                    <td>
                      <CartPrice value={totals.subtotal} />
                    </td>
                  </tr>
                  {appliedCoupons.map((applied) => (
                    <CouponRow
                      key={applied.code}
                      code={applied.code}
                      amount={totals.couponTotals.get(applied.code) ?? 0n}
                      freeShipping={applied.freeShipping}
                      remove={<RemoveCouponLink code={applied.code} href={`/checkout/?remove_coupon=${encodeURIComponent(applied.code)}`} busy={removing} onRemove={() => removeCoupon(applied.code)} />}
                    />
                  ))}
                  <OfferRow state={totals.offer} />
                  <tr className="woocommerce-shipping-totals shipping">
                    <th>Shipment</th>
                    <td data-title="Shipment">
                      <ul id="shipping_method" className="woocommerce-shipping-methods">
                        {totals.shipping ? (
                          <li>
                            <input type="hidden" name="shipping_method[0]" data-index="0" id={`shipping_method_0_${totals.shipping.rateId.replace(":", "")}`} value={totals.shipping.rateId} className="shipping_method" />
                            <label htmlFor={`shipping_method_0_${totals.shipping.rateId.replace(":", "")}`}>
                              {totals.shipping.cost > 0n ? (
                                <>
                                  {totals.shipping.title}: <CartAmount value={totals.shipping.cost} />
                                </>
                              ) : (
                                totals.shipping.title
                              )}
                            </label>
                          </li>
                        ) : null}
                      </ul>
                    </td>
                  </tr>
                  {totals.paymentAdjustment ? (
                    <tr className="fee">
                      <th>{totals.paymentAdjustment.label}</th>
                      <td>
                        <CartAmount value={totals.paymentAdjustment.amount} /> <span className="atlas-usd-price">{formatUsd(totals.paymentAdjustment.amount < 0n ? -totals.paymentAdjustment.amount : totals.paymentAdjustment.amount)}</span>
                      </td>
                    </tr>
                  ) : null}
                  <tr className="order-total">
                    <th>Total</th>
                    <td>
                      <strong>
                        <CartAmount value={totals.total} />
                      </strong>{" "}
                      <span className="atlas-usd-price">{formatUsd(totals.total)}</span>
                    </td>
                  </tr>
                  <tr className="sleeks-coupon-total-row">
                    <td colSpan={2}>
                      <div className="sleeks-coupon-box">
                        <button
                          type="button"
                          className="sleeks-coupon-toggle"
                          aria-expanded={couponOpen}
                          onClick={() => {
                            slide(couponContent.current, !couponOpen);
                            setCouponOpen((open) => !open);
                          }}
                        >
                          <span>Have a coupon or Affiliate code?</span>
                          <span className="sleeks-coupon-arrow">{couponOpen ? "−" : "+"}</span>
                        </button>
                        <div ref={couponContent} className="sleeks-coupon-content" style={{ display: "none" }}>
                          <div className="sleeks-coupon-fields">
                            <input
                              ref={couponInput}
                              type="text"
                              className="sleeks-checkout-coupon"
                              placeholder="Enter coupon or affiliate code"
                              autoComplete="off"
                              onKeyDown={(event) => {
                                // The snippet: Enter applies the code (and never sends the checkout form).
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  if (!applying) applyCoupon();
                                }
                              }}
                            />
                            <button type="button" className="button sleeks-apply-coupon" disabled={applying} onClick={applyCoupon}>
                              {applying ? "Applying..." : "Apply"}
                            </button>
                          </div>
                          <div className={`sleeks-coupon-response${coupon ? (coupon.ok ? " success" : " error") : ""}`} aria-live="polite">
                            {coupon?.message}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div id="payment" className="woocommerce-checkout-payment">
              <ul className="wc_payment_methods payment_methods methods" aria-label="Payment methods">
                {totals.paymentOptions.map((method) => {
                  const details = PAYMENT_DETAILS[method.id];
                  const isChosen = chosen === method.id;
                  const cardLocked = method.id === "atlas_card" && !method.available;
                  const codLocked = method.id === "cod" && !method.available;
                  const classes = `wc_payment_method payment_method_${method.id}${cardLocked ? " atlas-card-minimum-locked" : ""}${codLocked ? " atlas-cod-locked" : ""}`;
                  // The owner's fee snippet prints the fee on the method whether it is chosen or locked.
                  const fee = method.adjustment?.type === "fee" && totals.cartAmount > 0n ? percentOf(totals.cartAmount, method.adjustment.percent) : null;
                  return (
                    <li key={method.id} className={classes}>
                      <input
                        id={`payment_method_${method.id}`}
                        type="radio"
                        className="input-radio"
                        name="payment_method"
                        value={method.id}
                        checked={isChosen}
                        disabled={!method.available}
                        // As live: the card's snippet always sets it, the COD snippet only when locked.
                        aria-disabled={method.id === "atlas_card" || !method.available ? !method.available : undefined}
                        data-order_button_text=""
                        onChange={() => setPaymentId(method.id)}
                      />
                      <label htmlFor={`payment_method_${method.id}`}>
                        {" "}
                        {method.title}{" "}
                        {details.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- the providers' own logos, as on live
                          <img src={details.logo.src} alt={details.logo.alt} />
                        ) : null}
                      </label>
                      {codLocked ? (
                        <div className="atlas-cod-lock-message">
                          <strong>{method.locked?.title}</strong>
                          <span>{method.locked?.text}</span>
                        </div>
                      ) : null}
                      <div className={`payment_box payment_method_${method.id}`} style={isChosen ? undefined : { display: "none" }}>
                        {fee !== null ? (
                          <div className="atlas-payment-fee-message">
                            {method.adjustment!.percent}% payment adjustment: +<CartAmount value={fee} /> <span className="atlas-payment-usd">{usdPlain(fee)}</span>
                          </div>
                        ) : null}
                        <p>{details.description}</p>
                      </div>
                      {cardLocked ? (
                        <div className="atlas-card-minimum-note" role="status">
                          <strong>{method.locked?.title}</strong>
                          <span>{method.locked?.text}</span>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="form-row place-order">
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
                {cardState ? <input type="hidden" id="atlas-card-minimum-state" data-gateway="atlas_card" data-locked={cardState.available ? "0" : "1"} data-message={cardState.locked?.text ?? cardState.minimum?.lockText(totals.cartAmount)} /> : null}
                <button type="submit" className="button alt" name="woocommerce_checkout_place_order" id="place_order" value="Place order" data-value="Place order" disabled={!hydrated || placing}>
                  Place order
                </button>
                <div className="checkout-whatsapp-order">
                  <span>Prefer to order via WhatsApp? </span>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    Chat with us and we will take it from there.
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
