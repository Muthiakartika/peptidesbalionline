"use server";

/**
 * The checkout's Server Actions.
 *   * placeOrder: works the totals out again on the server (prices from the catalogue, the payment
 *     method's fee and minimum), runs the live checks (src/lib/commerce/checkout-validation.ts), then saves
 *     the order (src/lib/commerce/orders.ts), empties the cart and answers where the browser goes next: the
 *     thank-you page, or WhatsApp for IDR Account (the owner's gateway). "Create an account?" makes the
 *     account first, as WooCommerce does; a logged-in customer's billing address is kept for next time.
 *     The online providers (NOWPayments, PayRam, BitBridge Pay) aren't connected yet (Q-01): choosing one
 *     says so and saves nothing.
 *   * applyCheckoutCoupon: the owner's coupon box ("Have a coupon or Affiliate code?"), with its texts,
 *     on the coupons imported from WooCommerce (src/lib/commerce/coupon-store.ts).
 */
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

import { getDb } from "@/db";
import { addresses, users } from "@/db/schema";
import { getAuth, NEW_ACCOUNT_MARKER, passwordEmailResults } from "@/lib/auth";
import { ACCOUNT_COOKIE } from "@/lib/account/account-cookie";
import { getAccountUser, logoutTokenFor } from "@/lib/account/session";
import { createCustomerUsername } from "@/lib/account/username";
import type { StoredCart } from "@/lib/commerce/cart-cookie";
import { cartCouponState, COUPON_CHECK_FAILED, withoutCoupons } from "@/lib/commerce/cart-coupons";
import { priceCart, type PricedLine } from "@/lib/commerce/cart-lines";
import { readCart, writeCart } from "@/lib/commerce/cart-store";
import { categoryNamer, couponCustomer, findCoupons, formatCouponCode, timesUsedBy, type StoredCoupon } from "@/lib/commerce/coupon-store";
import { applyCoupon, checkCouponForCustomer, couponMessages } from "@/lib/commerce/coupons";
import { validateCheckout, type CheckoutInput, type CheckoutMessage, isPaymentMethodId } from "@/lib/commerce/checkout-validation";
import { afterOrderAddress, createOrder, internationalPhone } from "@/lib/commerce/orders";
import { paymentMethods } from "@/lib/commerce/store-settings";
import { computeTotals } from "@/lib/commerce/totals";
import { sendOrderStatusEmails } from "@/lib/email/order-notifications";

export type PlaceOrderResult = { ok: false; messages: CheckoutMessage[] } | { ok: true; redirect: string };

/** What the form sends besides the checked fields. */
/** `location`: the map's pin (lat / lng) and Google's formatted address of it (live's _atlas_google_formatted_address). */
export type CheckoutExtras = { createAccount?: boolean; notes?: string; location?: { lat?: string; lng?: string; address?: string } };

/** A coordinate from the map, or nothing: only a plain decimal within the earth's range is kept. */
const coordinate = (value: unknown, limit: number) => {
  const text = typeof value === "string" ? value.trim().slice(0, 30) : "";
  const number = Number(text);
  return /^-?\d{1,3}(\.\d{1,10})?$/.test(text) && Math.abs(number) <= limit ? text : undefined;
};

const text = (value: unknown, max = 500) => (typeof value === "string" ? value.slice(0, max) : "");

/** Everything the form sends, read defensively (a Server Action can receive anything). */
function readInput(raw: Partial<CheckoutInput>): CheckoutInput {
  const b = (raw.billing ?? {}) as Partial<CheckoutInput["billing"]>;
  const s = (raw.shipping ?? {}) as Partial<CheckoutInput["shipping"]>;
  return {
    deliveryAddress: text(raw.deliveryAddress),
    billing: {
      fullName: text(b.fullName, 200),
      phoneCountryCode: text(b.phoneCountryCode, 20),
      phone: text(b.phone, 40),
      email: text(b.email, 200),
      country: text(b.country, 2),
      address1: text(b.address1),
      city: text(b.city, 200),
      state: text(b.state, 4),
      postcode: text(b.postcode, 20),
    },
    shipToDifferentAddress: raw.shipToDifferentAddress === true,
    shipping: {
      firstName: text(s.firstName, 200),
      lastName: text(s.lastName, 200),
      phone: text(s.phone, 40),
      country: text(s.country, 2),
      address1: text(s.address1),
      city: text(s.city, 200),
      state: text(s.state, 4),
      postcode: text(s.postcode, 20),
    },
    deliveryDay: text(raw.deliveryDay, 10),
    deliveryTime: text(raw.deliveryTime, 11),
    terms: raw.terms === true,
    paymentMethod: text(raw.paymentMethod, 40),
  };
}

const unavailable = (error: unknown): PlaceOrderResult => {
  console.error("[checkout] database error", error);
  return { ok: false, messages: [{ text: "Your order couldn't be saved: the shop's database can't be reached right now. Please try again in a moment, or order via WhatsApp." }] };
};

/**
 * The coupons at "Place order", as WooCommerce checks them while validating the checkout: the cart check
 * (check_cart_coupons: an invalid one is removed with its notice) and the customer check
 * (check_customer_coupons: "Allowed emails" against the billing e-mail, a guest's per-customer limit by
 * billing e-mail). Their notices come before the field errors, as WooCommerce adds them first.
 */
async function checkoutCoupons(cart: StoredCart, lines: PricedLine[], billingEmail: string) {
  const email = billingEmail.trim().toLowerCase();
  const state = await cartCouponState(cart, lines, email);
  if (state.failed) return { coupons: [], messages: [{ text: COUPON_CHECK_FAILED }], drop: [] as string[] };
  const messages: CheckoutMessage[] = state.notices.map((notice) => ({ text: notice }));
  const drop = [...state.removedCodes];
  const kept: StoredCoupon[] = [];
  for (const coupon of state.coupons) {
    const check = checkCouponForCustomer(coupon, { emails: state.customer?.emails ?? [email], guest: !state.customer?.userId, timesUsedByEmail: timesUsedBy(coupon, [email]) });
    if (check.ok) kept.push(coupon);
    else {
      messages.push({ text: check.error });
      if (check.remove) drop.push(coupon.code);
      else kept.push(coupon);
    }
  }
  return { coupons: kept, messages, drop };
}

export async function placeOrder(raw: Partial<CheckoutInput>, extras: CheckoutExtras = {}): Promise<PlaceOrderResult> {
  const input = readInput(raw);
  const cart = await readCart();
  const { lines, errors } = await priceCart(cart.items);
  if (!lines.length) return { ok: false, messages: [{ text: "Sorry, your session has expired. Return to shop" }] };
  const couponCheck = await checkoutCoupons(cart, lines, input.billing.email);
  if (couponCheck.drop.length) await writeCart(withoutCoupons(cart, couponCheck.drop));
  const totals = computeTotals({ lines, coupons: couponCheck.coupons, paymentId: isPaymentMethodId(input.paymentMethod) ? input.paymentMethod : null, preselectPayment: false });
  const messages = [...couponCheck.messages, ...validateCheckout(input, { totals, cartErrors: errors })];
  if (messages.length) return { ok: false, messages };
  const method = paymentMethods.find((m) => m.id === input.paymentMethod)!;
  if (method.kind === "online") {
    return { ok: false, messages: [{ text: `${method.title} can't be used on this copy of the shop yet: the payment provider isn't connected. Please choose another payment method.` }] };
  }

  let userId: string | null = null;
  try {
    const user = await getAccountUser().catch(() => null);
    userId = user?.id ?? null;
    const email = input.billing.email.trim().toLowerCase();
    if (!userId && extras.createAccount === true) {
      // WooCommerce's checkout registration: user name from the e-mail, a generated password, logged in.
      const db = getDb();
      const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (existing) return { ok: false, messages: [{ text: `An account is already registered with ${email}. Please log in or use a different email address.` }] };
      const username = await createCustomerUsername(email, async (name) => (await db.select({ id: users.id }).from(users).where(sql`${users.username} = ${name}`).limit(1)).length > 0);
      const created = await getAuth().api.signUpEmail({ body: { email, password: randomBytes(18).toString("base64url"), name: username, username }, headers: await headers() });
      if (!created?.token) throw new Error("sign-up gave no session");
      userId = created.user.id;
      await db.update(users).set({ temporaryPassword: true }).where(sql`${users.id} = ${created.user.id}`);
      (await cookies()).set(ACCOUNT_COOKIE, logoutTokenFor(created.token), { path: "/", sameSite: "lax" });
      // WooCommerce's "Your account has been created!" e-mail with the set-password link.
      passwordEmailResults.delete(email);
      await getAuth().api.requestPasswordReset({ body: { email, redirectTo: NEW_ACCOUNT_MARKER }, headers: await headers() });
      passwordEmailResults.delete(email);
    }
    const order = await createOrder({
      input,
      lines,
      totals,
      coupons: couponCheck.coupons.map((coupon) => ({ coupon, amount: totals.couponTotals.get(coupon.code) ?? 0n })),
      userId,
      notes: (extras.notes ?? "").slice(0, 2000).trim(),
      // As live: the pin's Google address when the customer used the map, else what they typed.
      deliveryLocation: {
        address: text(extras.location?.address).trim() || input.deliveryAddress,
        lat: coordinate(extras.location?.lat, 90),
        lng: coordinate(extras.location?.lng, 180),
      },
    });
    if (userId) {
      // WooCommerce keeps the customer's checkout address on the account (the next checkout starts with it).
      const b = input.billing;
      const billing = {
        firstName: b.fullName,
        phone: internationalPhone(b.phoneCountryCode, b.phone),
        phoneCountryCode: b.phoneCountryCode,
        email,
        address1: b.address1,
        city: b.city,
        state: b.state,
        postcode: b.postcode.trim().toUpperCase(),
        country: b.country,
      };
      await getDb()
        .insert(addresses)
        .values({ userId, type: "billing", ...billing })
        .onConflictDoUpdate({ target: [addresses.userId, addresses.type], set: { ...billing, updatedAt: new Date() } });
    }
    // The cart is emptied (the shipping destination stays, as WooCommerce's customer data does).
    await writeCart({ items: [], coupons: [], destination: cart.destination });
    // WooCommerce's order e-mails: the order starts "pending" and the payment method moves it on (Card, Revolut,
    // Wise: on hold, COD: processing → "New order" to the shop and the customer's e-mail; IDR Account stays
    // pending: none yet). Never throws: a problem sending doesn't touch the order.
    await sendOrderStatusEmails(order.id, "pending", method.statusAfterOrder);
    return { ok: true, redirect: afterOrderAddress(method.id, order) };
  } catch (error) {
    return unavailable(error);
  }
}

/** `notice`: WooCommerce's own "Coupon code applied successfully.", which live shows at the top of the form. */
export type CouponResult = { ok: boolean; message: string; notice?: string };

/**
 * The owner's coupon box (WPCode snippet 6479, sleeks_apply_checkout_coupon): "This coupon is already
 * applied." first, then WooCommerce's WC_Cart::apply_coupon and its first error, else "Coupon applied
 * successfully.". A new individual-use coupon replaces the others, as WooCommerce does.
 */
export async function applyCheckoutCoupon(code: string): Promise<CouponResult> {
  const formatted = formatCouponCode(text(code, 100));
  if (!formatted) return { ok: false, message: "Please enter a coupon code." };
  try {
    const cart = await readCart();
    const { lines } = await priceCart(cart.items);
    if (cart.coupons.some((applied) => formatCouponCode(applied) === formatted)) return { ok: false, message: "This coupon is already applied." };
    const state = await cartCouponState(cart, lines);
    if (state.failed) return { ok: false, message: "Something went wrong. Please try again." };
    const customer = state.customer ?? (await couponCustomer(await getAccountUser().catch(() => null)));
    const coupon = (await findCoupons([formatted])).get(formatted);
    const result = applyCoupon(coupon, formatted, lines, state.coupons, {
      categoryName: await categoryNamer(),
      timesUsedByUser: coupon && customer.userId ? timesUsedBy(coupon, customer.keys) : 0,
      emails: customer.emails,
    });
    if (!result.ok) {
      if (state.removedCodes.length) await writeCart(withoutCoupons(cart, state.removedCodes));
      return { ok: false, message: result.error };
    }
    await writeCart({ ...cart, coupons: result.applied.map((c) => c.code) });
    return { ok: true, message: "Coupon applied successfully.", notice: couponMessages.applied };
  } catch (error) {
    console.error("[checkout] coupon", error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
