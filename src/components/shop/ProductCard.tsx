"use client";

/**
 * One product in a shop grid. Redesigned on 12 Nov 2026 after the owner's reference shops: picture
 * on a cream tile (sale / sold-out badge, quick-view button), then category, name, the options as
 * small pills, and "From Rp…" next to one button.
 *
 * What a visitor can do with it:
 *   * hover (desktop): the card lifts, a second image fades in, the quick-view button appears;
 *   * variable products: pick the options in the card ("quick shop"). When every option is picked,
 *     the price and image change to that variation and the button says "Add to cart".
 *
 * "Quick view" opens the product in a popup (src/components/product/QuickView.tsx); while its data
 * loads the button shows a spinner, as on the live site.
 *
 * "Add to cart" (a simple product, or the variation picked in the card) adds one to the cart and opens
 * the side cart, as the live AJAX button does (Server Action addToCart). "Select options", and a product
 * or variation that is out of stock, opens the product page (with the chosen options in the URL,
 * ?attribute_pa_mg=10), which is also what the button does on live without JavaScript.
 *
 * The shop's list view (?shop_view=list, `view="list"`): the same card laid out as Woodmart's list item,
 * picture on the left and, under the options, the product's short description (passed in, already
 * cleaned, by the shop page); phones and tablets show it as a one-column card without the description.
 *
 * Styles: ".product-card" in src/styles/shop.css ([data-view="list"] for the list view).
 */
import Link from "next/link";
import { useState, useTransition, type KeyboardEvent } from "react";

import { addToCart } from "@/app/(store)/cart/actions";
import { useChrome } from "@/components/layout/ChromeProvider";
import { announceCartChange } from "@/lib/commerce/useCartCount";

import { loadQuickView, QuickView } from "@/components/product/QuickView";
import type { QuickViewResponse } from "@/components/product/quick-view-types";
import { Icon } from "@/components/ui/Icon";
import { isPurchasableVariation } from "@/lib/catalog/purchasable";
import type { Product, Variation } from "@/lib/catalog/types";
import { formatUsd } from "@/lib/catalog/usd";
import { formatMoney } from "@/lib/money";
import { struckRegular } from "@/lib/catalog/sale";

type Selection = Record<string, string>;

/** WooCommerce rule: a variation matches when every chosen option equals its value ("" = any). */
function matches(variation: Variation, selection: Selection): boolean {
  return Object.entries(selection).every(([name, value]) => !value || !variation.attributes[name] || variation.attributes[name] === value);
}

function Price({ min, max, regular }: { min: bigint; max: bigint; regular?: bigint }) {
  const was = struckRegular(min, max, regular);
  if (was !== null) {
    // WooCommerce's sale price (wc_format_sale_price): the regular price struck through, then the sale price.
    return (
      <>
        <del aria-hidden="true">
          <span className="price__amount">{formatMoney(was)}</span>
        </del>{" "}
        <span className="sr-only">Original price was: {formatMoney(was)}.</span>
        <ins aria-hidden="true">
          <span className="price__amount">{formatMoney(min)}</span>
        </ins>
        <span className="sr-only">Current price is: {formatMoney(min)}.</span> <span className="price__usd">{formatUsd(min)}</span>
      </>
    );
  }
  if (min === max) {
    return (
      <>
        <span className="price__amount">{formatMoney(min)}</span> <span className="price__usd">{formatUsd(min)}</span>
      </>
    );
  }
  // The live site prints "Rp2,500,000.00 – Rp8,500,000.00" but hides the dash and the maximum; the
  // cards say "From" before the minimum.
  return (
    <>
      <span className="price__from" aria-hidden="true">
        From
      </span>{" "}
      <span className="price__amount" aria-hidden="true">
        {formatMoney(min)}
      </span>{" "}
      <span className="price__dash" aria-hidden="true">
        –
      </span>{" "}
      <span className="price__amount price__amount--max" aria-hidden="true">
        {formatMoney(max)}
      </span>
      <span className="sr-only">
        Price range: {formatMoney(min)} through {formatMoney(max)}
      </span>{" "}
      <span className="price__usd">{formatUsd(min, max)}</span>
    </>
  );
}

export function ProductCard({ product, view = "grid", shortDescription = null }: { product: Product; view?: "grid" | "list"; shortDescription?: string | null }) {
  const [selection, setSelection] = useState<Selection>({});
  const [quickView, setQuickView] = useState<QuickViewResponse | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [adding, startAdding] = useTransition();
  const chrome = useChrome();
  const attributes = product.quickShop;
  const allPicked = attributes.length > 0 && attributes.every((a) => selection[a.name]);
  const chosen = allPicked ? product.variations.find((v) => isPurchasableVariation(v) && matches(v, selection)) : undefined;

  const choose = (name: string, value: string) => setSelection((current) => ({ ...current, [name]: value }));
  // Clicking the active pill again clears it (Woodmart swatches).
  const toggle = (name: string, value: string) => setSelection((current) => ({ ...current, [name]: current[name] === value ? "" : value }));
  const onSwatchKey = (event: KeyboardEvent, name: string, value: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(name, value);
    }
  };

  const productHref = chosen
    ? `${product.path}?${new URLSearchParams(Object.entries(selection).filter(([, v]) => v)).toString()}`
    : product.path;
  // A chosen variation shows its own picture: WooCommerce swaps in its thumbnail as src, plus that
  // image's srcset and sizes (so desktops load the 600px file).
  const image = chosen?.image
    ? {
        ...product.image,
        src: chosen.image.src,
        srcset: chosen.image.srcset ?? undefined,
        sizes: chosen.image.sizes ?? undefined,
        alt: chosen.image.alt || product.image.alt,
      }
    : product.image;
  const buttonLabel = product.type === "simple" || chosen ? "Add to cart" : "Select options";
  const canAdd = product.type === "simple" ? product.inStock : Boolean(chosen?.inStock);
  // Badge on the picture: sold out, or how much a sale takes off (simple products on sale).
  const was = struckRegular(product.priceMin, product.priceMax, product.regularPrice);
  const badge = !product.inStock ? "Sold out" : was !== null && was > 0n ? `−${Number(((was - product.priceMin) * 100n) / was)}%` : null;

  return (
    <div className="product-card" data-view={view}>
      <div className="product-card__wrapper">
        <div className="product-card__top">
          <Link href={productHref} className="product-card__image-link" tabIndex={-1} aria-label={product.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- same image files and sizes as the live cards (Phase 4 moves them to the Sanity CDN) */}
            <img src={image.src} srcSet={image.srcset} sizes={image.sizes} width={image.width} height={image.height} alt={image.alt} loading="lazy" decoding="async" />
          </Link>
          {product.hoverImage ? (
            <div className="product-card__hover-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
              <img src={product.hoverImage.src} srcSet={product.hoverImage.srcset} sizes={product.hoverImage.sizes} width={product.hoverImage.width} height={product.hoverImage.height} alt={product.hoverImage.alt} loading="lazy" decoding="async" />
            </div>
          ) : null}
          {badge ? (
            <span className="product-card__badge" data-sold-out={!product.inStock || undefined}>
              {badge}
            </span>
          ) : null}
          <div className="product-card__buttons">
            <Link
              href={product.path}
              className={`product-card__quick-view${quickViewLoading ? " product-card__quick-view--loading" : ""}`}
              rel="nofollow"
              onClick={(event) => {
                event.preventDefault();
                if (quickViewLoading) return;
                setQuickViewLoading(true);
                loadQuickView(product.id)
                  .then(setQuickView)
                  .catch(() => window.location.assign(product.path)) // the product page instead
                  .finally(() => setQuickViewLoading(false));
              }}
            >
              <Icon name="search" />
              <span className="product-card__quick-view-text">Quick view</span>
            </Link>
          </div>
          {quickView ? <QuickView data={quickView} onClose={() => setQuickView(null)} /> : null}
        </div>

        <div className="product-card__bottom">
          <div className="product-card__cats">
            {product.cardCategories.map((category, index) => (
              <span key={category.path}>
                {index > 0 ? ", " : null}
                <Link href={category.path} rel="tag">
                  {category.name}
                </Link>
              </span>
            ))}
          </div>

          <h3 className="product-card__title">
            <Link href={productHref}>{product.name}</Link>
          </h3>

          {view === "list" && shortDescription ? (
            // The product's short description (WooCommerce's excerpt), HTML from the live site.
            <div className="product-card__short woocommerce-product-details__short-description" data-legacy-html="" dangerouslySetInnerHTML={{ __html: shortDescription }} />
          ) : null}

          {attributes.length > 0 ? (
            <form className="quick-shop" action={product.path} method="get" onSubmit={(event) => event.preventDefault()}>
              <table className="quick-shop__table" role="presentation">
                <tbody>
                  {attributes.map((attribute) => {
                    const id = `${attribute.name.replace(/^attribute_/, "")}-${product.id}`;
                    return (
                      <tr key={attribute.name}>
                        <th className="quick-shop__label">
                          <label htmlFor={id}>{attribute.label}</label>
                        </th>
                        <td className="quick-shop__value" data-swatches={attribute.swatches}>
                          {attribute.swatches ? (
                            <div className="swatches" role="radiogroup" aria-label={attribute.label}>
                              {attribute.options.map((option) => {
                                const active = selection[attribute.name] === option.value;
                                return (
                                  <div
                                    key={option.value}
                                    className="swatch"
                                    data-active={active}
                                    role="radio"
                                    aria-checked={active}
                                    aria-label={option.label}
                                    tabIndex={0}
                                    onClick={() => toggle(attribute.name, option.value)}
                                    onKeyDown={(event) => onSwatchKey(event, attribute.name, option.value)}
                                  >
                                    <span className="swatch__text">{option.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          <select
                            id={id}
                            name={attribute.name}
                            className="quick-shop__select"
                            value={selection[attribute.name] ?? ""}
                            onChange={(event) => choose(attribute.name, event.target.value)}
                          >
                            <option value="">Choose an option</option>
                            {attribute.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </form>
          ) : null}

          <div className="product-card__foot">
            <span className="price">
              {chosen ? (
                // The chosen variation's own price.
                <Price min={chosen.price} max={chosen.price} regular={chosen.regularPrice} />
              ) : (
                <Price min={product.priceMin} max={product.priceMax} regular={product.regularPrice} />
              )}
            </span>

            <div className="product-card__add">
              <Link
                href={productHref}
                className={`product-card__button${adding ? " loading" : ""}`}
                rel="nofollow"
                aria-busy={adding || undefined}
                onClick={(event) => {
                  if (!canAdd) return; // the product page
                  event.preventDefault();
                  if (adding) return;
                  startAdding(async () => {
                    const result = await addToCart(product.id, chosen?.id ?? null, 1);
                    announceCartChange();
                    if (result.ok) chrome.open("cart");
                    else window.location.assign(productHref);
                  });
                }}
              >
                <span>{buttonLabel}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
