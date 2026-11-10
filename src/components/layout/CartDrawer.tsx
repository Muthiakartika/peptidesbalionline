"use client";

/**
 * Right-hand "Shopping cart" drawer (Woodmart's side cart). Empty: WooCommerce's empty state, as for a
 * new visitor. With products: WooCommerce's mini cart, markup as on live
 * (docs/audit/visual-reference/markup/mini-cart.html, captured 6 Nov 2026): each product with its
 * picture, name, "1 × Rp…" and a × to remove it, then "Subtotal:", "View cart" and "Checkout".
 * The content is read from the server (getMiniCart) when the drawer opens and after every cart change;
 * live opens it by itself after "Add to cart" (AddToCartForm). Styles: src/styles/mini-cart.css.
 */
import "@/styles/mini-cart.css";
import "@/styles/backorder-owner.css";
// The owner's USD hints ("~$72.73") are in the drawer on every page.
import "@/styles/usd-prices-owner.css";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { getMiniCart, removeFromCart, type MiniCart } from "@/app/(store)/cart/actions";
import { CartAmount } from "@/components/woocommerce/cart/CartPrice";
import { BackorderBadge } from "@/components/woocommerce/cart/BackorderBadge";
import { formatUsd } from "@/lib/catalog/usd";
import { CART_CHANGED_EVENT } from "@/lib/commerce/cart-cookie";
import { announceCartChange } from "@/lib/commerce/useCartCount";

import { useChrome } from "./ChromeProvider";
import { Icon } from "@/components/ui/Icon";

export function CartDrawer() {
  const { openPanel, close } = useChrome();
  const isOpen = openPanel === "cart";
  const [cart, setCart] = useState<MiniCart | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => setCart(await getMiniCart()));
  }, []);

  // Read the cart when the drawer opens, and again whenever the cart changes elsewhere.
  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);
  useEffect(() => {
    window.addEventListener(CART_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CART_CHANGED_EVENT, refresh);
  }, [refresh]);

  const lines = cart?.lines ?? [];
  return (
    <>
      <div className="side-overlay" data-open={isOpen} onClick={close} aria-hidden="true" />
      <aside className="side-drawer side-drawer--right cart-widget-side" data-open={isOpen} aria-label="Shopping cart sidebar" aria-hidden={!isOpen} inert={!isOpen}>
        <div className="side-drawer__heading">
          <span className="side-drawer__title">Shopping cart</span>
          <button type="button" className="side-drawer__close" onClick={close}>
            <Icon name="close" />
            Close
          </button>
        </div>
        {lines.length ? (
          <div className="widget woocommerce widget_shopping_cart" data-legacy-html="">
            <div className="widget_shopping_cart_content">
              <div className="shopping-cart-widget-body wd-scroll">
                <div className="wd-scroll-content">
                  <ul className="cart_list product_list_widget woocommerce-mini-cart ">
                    {lines.map((line) => (
                      <li key={line.key} className={`woocommerce-mini-cart-item mini_cart_item${removing === line.key ? " removing-process" : ""}`} data-key={line.key}>
                        <Link href={line.href} className="cart-item-link wd-fill" onClick={close}>
                          Show
                        </Link>
                        <a
                          role="button"
                          href="#"
                          className="remove remove_from_cart_button"
                          aria-label={`Remove ${line.name} from cart`}
                          data-product_id={line.productId}
                          data-cart_item_key={line.key}
                          data-product_sku=""
                          onClick={(event) => {
                            event.preventDefault();
                            setRemoving(line.key);
                            startTransition(async () => {
                              await removeFromCart(line.key);
                              setCart(await getMiniCart());
                              setRemoving(null);
                              announceCartChange();
                            });
                          }}
                        >
                          ×
                        </a>
                        <Link href={line.href} className="cart-item-image" onClick={close}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- the live <img>, sized by the theme's CSS */}
                          <img width={300} height={300} src={line.image.src} className="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt={line.image.alt} decoding="async" loading="lazy" />
                        </Link>
                        <div className="cart-info">
                          <span className="wd-entities-title"> {line.name} </span>
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
                          <span className="quantity">
                            {line.quantity} × <CartAmount value={BigInt(line.unitPrice)} /> <span className="atlas-usd-price">{formatUsd(BigInt(line.unitPrice))}</span>
                          </span>
                          {line.backorder ? <BackorderBadge /> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="shopping-cart-widget-footer">
                <p className="woocommerce-mini-cart__total total">
                  <strong>Subtotal:</strong> <CartAmount value={BigInt(cart!.subtotal)} /> <span className="atlas-usd-price">{formatUsd(BigInt(cart!.subtotal))}</span>
                </p>
                <p className="woocommerce-mini-cart__buttons buttons">
                  <Link href="/cart/" className="button btn-cart wc-forward" onClick={close}>
                    View cart
                  </Link>
                  <Link href="/checkout/" className="button checkout wc-forward" onClick={close}>
                    Checkout
                  </Link>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mini-cart-empty">
            <Icon name="emptyCart" className="mini-cart-empty__icon" />
            <p className="mini-cart-empty__text">No products in the cart.</p>
            <Link href="/shop/" className="btn-accented" onClick={close}>
              Return To Shop
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
