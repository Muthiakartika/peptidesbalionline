/**
 * The cart page's content for the visitor's cart (read from the cart cookie, so it is rendered for
 * each request, inside <Suspense> on the page). Markup as on the live site
 * (docs/audit/visual-reference/markup/cart-*.html): WooCommerce's cart table, the owner's "Top up
 * your supplies", and the cart totals with "Change address" and "Proceed to checkout".
 * An empty cart shows WooCommerce's empty-cart page, as before.
 */
import Link from "next/link";

import { getProductById, type Product } from "@/lib/catalog";
import { priceCart, type PricedLine } from "@/lib/commerce/cart-lines";
import { cartCouponState } from "@/lib/commerce/cart-coupons";
import { readCart } from "@/lib/commerce/cart-store";
import { cartTopUp } from "@/lib/commerce/store-settings";
import { CURRENT_OFFER } from "@/lib/commerce/offers";
import { computeTotals } from "@/lib/commerce/totals";
import { formatUsd } from "@/lib/catalog/usd";

import { EmptyCart } from "../EmptyCart";

import { CartForm, CartNotices, CartQuantity, CartRemoveCoupon, RemoveItem, TopUpAdd } from "./CartControls";
import { BackorderBadge } from "./BackorderBadge";
import { CartAmount, CartPrice, ProductPriceHtml } from "./CartPrice";
import { CouponRow } from "./CouponRow";
import { OfferCard, OfferRow } from "@/components/woocommerce/OfferCard";
import { formatDestination } from "./destination";
import { ShippingCalculator } from "./ShippingCalculator";

/** WordPress's 300×300 product thumbnail ("woocommerce_thumbnail") of an image URL. */
function thumbnail(src: string): string {
  return src.replace(/-\d+x\d+(\.\w+)$/, "-300x300$1");
}

/** The product page address of a line; a variation's has its options in the query, as on live. */
function lineHref(line: PricedLine): string {
  if (!line.variation) return line.product.path;
  return `${line.product.path}?${new URLSearchParams(line.variation.attributes).toString()}`;
}

function CartRow({ line }: { line: PricedLine }) {
  const href = lineHref(line);
  const image = line.variation?.image ?? line.product.image;
  return (
    <tr className="woocommerce-cart-form__cart-item cart_item">
      <td className="product-remove">
        <RemoveItem lineKey={line.key} productId={line.productId} variationId={line.variationId} quantity={line.quantity} name={line.name} />
      </td>
      <td className="product-thumbnail">
        <Link href={href}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the live <img>, sized by the theme's CSS */}
          <img src={line.variation?.image ? image.src : thumbnail(image.src)} width={300} height={300} decoding="async" className="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt={image.alt} />
        </Link>
      </td>
      <td className="product-name" role="rowheader" data-title="Product">
        <Link href={href}>{line.name}</Link>
        {/* The owner's snippet "Backorder notice in Cart + Mini-cart" (only when WooCommerce doesn't print its own). */}
        {line.backorder && !line.backorder.notify ? <BackorderBadge /> : null}
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
        {/* WooCommerce's own line for products set to "Allow, but notify customer" (cart.php). */}
        {line.backorder?.notify ? <p className="backorder_notification">Available on backorder</p> : null}
      </td>
      <td className="product-price" data-title="Price">
        <CartPrice value={line.unitPrice} />
      </td>
      <td className="product-quantity" data-title="Quantity">
        <CartQuantity lineKey={line.key} name={line.name} quantity={line.quantity} />
      </td>
      <td className="product-subtotal" data-title="Subtotal">
        <CartPrice value={line.unitPrice * BigInt(line.quantity)} />
      </td>
    </tr>
  );
}

async function TopUp({ lines }: { lines: PricedLine[] }) {
  const inCart = new Set(lines.map((line) => line.productId));
  const products = (await Promise.all(cartTopUp.productIds.filter((id) => !inCart.has(id)).map((id) => getProductById(id)))).filter(
    (product): product is Product => !!product && product.inStock,
  );
  if (!products.length) return null;
  return (
    <section className="sleeks-cart-topup">
      <div className="sleeks-topup-header">
        <h2>{cartTopUp.title}</h2>
        <p>{cartTopUp.text}</p>
      </div>
      <div className="sleeks-topup-products">
        {products.map((product) => (
          <article key={product.id} className="sleeks-topup-product">
            <Link className="sleeks-topup-image" href={product.path}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the live <img>, sized by the owner's CSS */}
              <img src={thumbnail(product.image.src)} width={300} height={300} decoding="async" loading="lazy" className="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt={product.image.alt} />
            </Link>
            <div className="sleeks-topup-info">
              <Link className="sleeks-topup-name" href={product.path}>
                {product.name}
              </Link>
              <div className="sleeks-topup-price">
                <ProductPriceHtml min={product.priceMin} max={product.priceMax} regular={product.regularPrice} />
              </div>
            </div>
            {product.type === "simple" ? (
              <TopUpAdd productId={product.id} name={product.name} />
            ) : (
              <Link href={product.path} className=" button sleeks-topup-add ">
                Select
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export async function CartContents() {
  const cart = await readCart();
  const { lines, notices, errors } = await priceCart(cart.items);
  if (!lines.length) {
    return (
      <>
        <CartNotices serverErrors={notices} />
        <EmptyCart notices={false} />
      </>
    );
  }
  // The applied coupons that are still valid (WooCommerce's cart check drops the others, with a notice).
  const coupons = await cartCouponState(cart, lines);
  const totals = computeTotals({ lines, coupons: coupons.coupons, offer: CURRENT_OFFER });
  return (
    <div className="cart-content-wrapper">
      <CartNotices serverErrors={[...notices, ...errors, ...coupons.notices]} />
      <CartForm>
        <table className="shop_table shop_table_responsive shop-table-with-img cart woocommerce-cart-form__contents" cellSpacing={0}>
          <thead>
            <tr>
              <th className="product-remove">
                <span className="screen-reader-text">Remove item</span>
              </th>
              <th className="product-thumbnail">
                <span className="screen-reader-text">Thumbnail image</span>
              </th>
              <th scope="col" className="product-name">
                Product
              </th>
              <th scope="col" className="product-price">
                Price
              </th>
              <th scope="col" className="product-quantity">
                Quantity
              </th>
              <th scope="col" className="product-subtotal">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <CartRow key={line.key} line={line} />
            ))}
            <tr className="wd-cart-action-row">
              <td colSpan={12} className="actions">
                <div className="cart-actions">
                  {/* Hidden by the owner's CSS (snippet 11): coupons are entered at checkout. */}
                  <div className="coupon wd-coupon-form">
                    <label htmlFor="coupon_code" className="screen-reader-text">
                      Coupon:
                    </label>
                    <input type="text" name="coupon_code" className="input-text" id="coupon_code" placeholder="Coupon code" />
                    <button type="button" className="button" name="apply_coupon" value="Apply coupon">
                      Apply coupon
                    </button>
                  </div>
                  <button type="button" className="button wd-hide" name="update_cart" value="Update cart" disabled>
                    Update cart
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <TopUp lines={lines} />
      </CartForm>
      <div className="cart_totals ">
        <div className="cart-totals-inner wd-set-mb reset-last-child wd-layout-1">
          <OfferCard state={totals.offer} />
          <h2>Cart totals</h2>
          <table cellSpacing={0} className="shop_table shop_table_responsive">
            <tbody>
              <tr className="cart-subtotal">
                <th>Subtotal</th>
                <td data-title="Subtotal">
                  <CartPrice value={totals.subtotal} />
                </td>
              </tr>
              {coupons.coupons.map((coupon) => (
                <CouponRow key={coupon.code} code={coupon.code} amount={totals.couponTotals.get(coupon.code) ?? 0n} freeShipping={coupon.freeShipping} withDataTitle remove={<CartRemoveCoupon code={coupon.code} />} />
              ))}
              <OfferRow state={totals.offer} withDataTitle />
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
                  <p className="woocommerce-shipping-destination">
                    Shipping to <strong>{formatDestination(cart.destination)}</strong>.{" "}
                  </p>
                  <ShippingCalculator destination={cart.destination} />
                </td>
              </tr>
              <tr className="order-total">
                <th>Total</th>
                <td data-title="Total">
                  <strong>
                    <CartAmount value={totals.total} />
                  </strong>{" "}
                  <span className="atlas-usd-price">{formatUsd(totals.total)}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="wc-proceed-to-checkout">
            <Link href="/checkout/" className="checkout-button button alt wc-forward">
              {" "}
              Proceed to checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

