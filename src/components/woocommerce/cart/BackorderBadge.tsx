/**
 * The owner's snippet "Backorder notice in Cart + Mini-cart" (PHP snippet 10824, read in wp-admin
 * 7 Nov 2026): a green "Available on backorder" badge with a dot. Styles: src/styles/backorder-owner.css.
 */
export function BackorderBadge() {
  return (
    <span className="atlas-cart-backorder">
      <span className="atlas-cart-backorder-dot" aria-hidden="true" />
      Available on backorder
    </span>
  );
}
