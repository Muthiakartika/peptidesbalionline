/**
 * The running offer's card (the owner, 13 Nov 2026, after biopeptech.id): "Bundle of three — add 2
 * more products, save 20%", with a step per item, on the cart and checkout pages. It reads the offer
 * from the totals (src/lib/commerce/offers.ts via computeTotals), so it always shows what the cart
 * really gets. OfferBanner is the short version for a product page.
 * Plain markup (no state): used by server and client components. Styles: src/styles/offer.css.
 */
import "@/styles/offer.css";

import Link from "next/link";

import { CURRENT_OFFER, type OfferState } from "@/lib/commerce/offers";
import { formatMoney } from "@/lib/money";

import { CouponAmount } from "./cart/CartPrice";

const plural = (n: number) => (n === 1 ? "" : "s");
const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

export function OfferCard({ state, shopHref = "/shop/" }: { state: OfferState | null; shopHref?: string }) {
  if (!state) return null;
  const { offer, qualifyingQuantity, remaining, reached, blockedByCoupon, amount } = state;
  const saving = reached && !blockedByCoupon;
  const title = saving ? `You're saving ${offer.percent}%` : reached ? `Your ${offer.percent}% bundle discount is waiting` : `Add ${remaining} more product${plural(remaining)}, save ${offer.percent}%`;
  return (
    <aside className="offer-card" data-state={saving ? "saving" : reached ? "blocked" : "open"} aria-label={`${offer.name} offer`}>
      <div className="offer-card__top">
        <span className="offer-card__eyebrow">{offer.name}</span>
        <span className="offer-card__badge">{offer.percent}% off</span>
      </div>
      <p className="offer-card__title">{title}</p>
      <p className="offer-card__text">
        {saving ? (
          <>
            Every qualifying product in your cart is {offer.percent}% off: <strong>−{formatMoney(amount)}</strong>.
          </>
        ) : (
          `Applies to every qualifying product in your cart once you reach ${WORDS[offer.minQuantity] ?? offer.minQuantity}.`
        )}
      </p>
      <ol className="offer-card__steps" aria-label={`${Math.min(qualifyingQuantity, offer.minQuantity)} of ${offer.minQuantity}`}>
        {Array.from({ length: offer.minQuantity }, (_, i) => (
          <li key={i} data-done={i < qualifyingQuantity || undefined}>
            <span>{i < qualifyingQuantity ? "✓" : i + 1}</span>
          </li>
        ))}
      </ol>
      <p className="offer-card__count">
        {qualifyingQuantity} qualifying product{plural(qualifyingQuantity)} · quantities count
      </p>
      {blockedByCoupon ? <p className="offer-card__warn">The bundle offer doesn&rsquo;t combine with coupon codes. Remove the coupon to get {offer.percent}% off instead.</p> : null}
      {!reached ? (
        <Link href={shopHref} className="offer-card__cta">
          Add {remaining} more product{plural(remaining)} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
      <p className="offer-card__note">{offer.excludedNote}</p>
    </aside>
  );
}

/** Product page: the offer in one strip, for products that count towards it. */
export function OfferBanner() {
  const offer = CURRENT_OFFER;
  if (!offer.active) return null;
  return (
    <div className="offer-banner">
      <span className="offer-banner__big">{offer.percent}%</span>
      <span className="offer-banner__text">
        <span className="offer-banner__eyebrow">{offer.name} · off</span>
        <strong>Mix any {offer.minQuantity}+ products</strong>
        <span>Quantities count. The discount applies to every qualifying item in your cart.</span>
      </span>
    </div>
  );
}

/** The offer's line in the cart and checkout totals, after the coupons. */
export function OfferRow({ state, withDataTitle = false }: { state: OfferState | null; withDataTitle?: boolean }) {
  if (!state || state.amount === 0n) return null;
  const label = `${state.offer.name} (${state.offer.percent}%)`;
  return (
    <tr className="cart-discount offer-discount">
      <th>{label}</th>
      <td {...(withDataTitle ? { "data-title": label } : {})}>
        -<CouponAmount value={state.amount} />
      </td>
    </tr>
  );
}
