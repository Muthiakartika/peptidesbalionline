/**
 * WooCommerce's price markup on the cart page, as the live HTML has it
 * (docs/audit/visual-reference/markup/cart-*.html), with the owner's grey USD hint after it:
 *   * CartAmount: cart prices and totals (wc_price: <bdi> and a currency symbol not to be translated);
 *   * ProductPriceHtml: a product's price as in lists (get_price_html: no <bdi>; ranges "a – b").
 */
import { formatUsd } from "@/lib/catalog/usd";
import { formatMoney } from "@/lib/money";
import { struckRegular } from "@/lib/catalog/sale";

const digits = (minor: bigint) => formatMoney(minor).replace(/^-?Rp/, "");

/** A negative amount (e.g. an imported order's "Wise discount (5%)" fee) gets wc_price's "-" before the symbol. */
export function CartAmount({ value }: { value: bigint }) {
  return (
    <span className="woocommerce-Price-amount amount">
      <bdi>
        {value < 0n ? "-" : null}
        <span className="woocommerce-Price-currencySymbol" translate="no" dir="auto">
          Rp
        </span>
        {digits(value)}
      </bdi>
    </span>
  );
}

/**
 * The amount in a coupon row: wc_cart_totals_coupon_html runs its HTML through wp_kses, which drops <bdi>
 * and the translate attribute (live, 7 Nov 2026).
 */
export function CouponAmount({ value }: { value: bigint }) {
  return (
    <span className="woocommerce-Price-amount amount">
      <span className="woocommerce-Price-currencySymbol" dir="auto">
        Rp
      </span>
      {digits(value)}
    </span>
  );
}

/** A cart amount followed by the USD hint (the owner's snippet adds " ~$12.34" after it). */
export function CartPrice({ value }: { value: bigint }) {
  return (
    <>
      <CartAmount value={value} /> <span className="atlas-usd-price">{formatUsd(value)}</span>
    </>
  );
}

export function ProductPriceHtml({ min, max, regular }: { min: bigint; max: bigint; regular?: bigint }) {
  const amount = (value: bigint, hidden: boolean) => (
    <span className="woocommerce-Price-amount amount" aria-hidden={hidden || undefined}>
      <span className="woocommerce-Price-currencySymbol" dir="auto">
        Rp
      </span>
      {digits(value)}
    </span>
  );
  const was = struckRegular(min, max, regular);
  if (was !== null) {
    return (
      <>
        <del aria-hidden="true">{amount(was, false)}</del> <span className="screen-reader-text">Original price was: {formatMoney(was)}.</span>
        <ins aria-hidden="true">{amount(min, false)}</ins>
        <span className="screen-reader-text">Current price is: {formatMoney(min)}.</span> <span className="atlas-usd-price">{formatUsd(min)}</span>
      </>
    );
  }
  if (min === max) {
    return (
      <>
        {amount(min, false)} <span className="atlas-usd-price">{formatUsd(min)}</span>
      </>
    );
  }
  return (
    <>
      {amount(min, true)} <span aria-hidden="true">–</span> {amount(max, true)}
      <span className="screen-reader-text">
        Price range: {formatMoney(min)} through {formatMoney(max)}
      </span>{" "}
      <span className="atlas-usd-price">{formatUsd(min, max)}</span>
    </>
  );
}
