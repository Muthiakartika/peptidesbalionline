"use client";

/**
 * The "Add to cart" form of a product page, with WooCommerce's behaviour:
 *   * variable products: pick every option (pills or dropdown). Then the variation's price shows
 *     above the quantity, "Clear" appears, and the gallery switches to the variation's picture;
 *   * the quantity box has − and + buttons (minimum 1);
 *   * "Add to cart" before every option is picked shows WooCommerce's browser alert.
 *
 * "Add to cart" adds the product (or the chosen variation) in the chosen quantity to the visitor's cart
 * (Server Action addToCart, Phase 5), updates the cart counts in the header and opens the side cart,
 * as the live site does (the button shows Woodmart's "loading" spinner meanwhile; captured 6 Nov 2026).
 *
 * Class names are WooCommerce's, so the owner's CSS (src/styles/product-owner.css) applies.
 */
import { useId, useState, useTransition } from "react";

import { addToCart } from "@/app/(store)/cart/actions";
import { useChrome } from "@/components/layout/ChromeProvider";
import { announceCartChange } from "@/lib/commerce/useCartCount";

import type { ProductForm } from "@/lib/catalog/product-page";
import type { Variation } from "@/lib/catalog/types";
import { formatUsd } from "@/lib/catalog/usd";
import { formatMoney } from "@/lib/money";
import { struckRegular } from "@/lib/catalog/sale";

import { useProductGallery } from "./ProductGalleryContext";

type Selection = Record<string, string>;

const matches = (variation: Variation, selection: Selection) =>
  Object.entries(selection).every(([name, value]) => !value || !variation.attributes[name] || variation.attributes[name] === value);

/** The price at the top of the summary; it becomes the chosen variation's price. */
export function SummaryPrice({ min, max, regular }: { min: bigint; max: bigint; regular?: bigint }) {
  const { variation } = useProductGallery();
  return (
    <p className="price">
      {variation ? (
        // WooCommerce puts the variation's price_html (its own .price span) inside the <p>.
        <span className="price">
          <WooPrice min={variation.price} max={variation.price} regular={variation.regularPrice} />
        </span>
      ) : (
        <WooPrice min={min} max={max} regular={regular} />
      )}
    </p>
  );
}

/** A price as WooCommerce prints it (get_price_html): one price, a range, or a sale (regular struck through). */
export function WooPrice({ min, max, regular }: { min: bigint; max: bigint; regular?: bigint }) {
  const amount = (value: bigint, hidden = false) => (
    <span className="woocommerce-Price-amount amount" aria-hidden={hidden || undefined}>
      <bdi>
        <span className="woocommerce-Price-currencySymbol">Rp</span>
        {formatMoney(value).replace(/^Rp/, "")}
      </bdi>
    </span>
  );
  const was = struckRegular(min, max, regular);
  if (was !== null) {
    return (
      <>
        <del aria-hidden="true">{amount(was)}</del> <span className="screen-reader-text">Original price was: {formatMoney(was)}.</span>
        <ins aria-hidden="true">{amount(min)}</ins>
        <span className="screen-reader-text">Current price is: {formatMoney(min)}.</span> <span className="atlas-usd-price">{formatUsd(min)}</span>
      </>
    );
  }
  if (min === max) {
    return (
      <>
        {amount(min)} <span className="atlas-usd-price">{formatUsd(min)}</span>
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

function Quantity({ label }: { label: string }) {
  const id = useId();
  const [value, setValue] = useState(1);
  return (
    <div className="quantity">
      <input type="button" value="-" className="minus btn" aria-label="Decrease quantity" onClick={() => setValue((v) => Math.max(1, v - 1))} />
      <label className="screen-reader-text" htmlFor={id}>
        {label} quantity
      </label>
      <input
        type="number"
        id={id}
        className="input-text qty text"
        value={value}
        aria-label="Product quantity"
        min={1}
        name="quantity"
        step={1}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => setValue(Math.max(1, Number(event.target.value) || 1))}
      />
      <input type="button" value="+" className="plus btn" aria-label="Increase quantity" onClick={() => setValue((v) => v + 1)} />
    </div>
  );
}

function BackorderStock() {
  return (
    <p className="stock available-on-backorder wd-style-bordered">
      <span>Available on backorder</span>
    </p>
  );
}

/**
 * `backorder`: this product's and its variations' backorder settings by number (stock settings in
 * /admin/products/), e.g. { "9752": { notify: true } }: "Available on backorder" when notify is on.
 */
export function AddToCartForm({
  productId,
  productName,
  form,
  variations,
  backorder = {},
}: {
  productId: number;
  productName: string;
  form: ProductForm;
  variations: Variation[];
  backorder?: Record<string, { notify: boolean }>;
}) {
  const BACKORDER = backorder;
  const gallery = useProductGallery();
  const [adding, startAdding] = useTransition();
  const chrome = useChrome();
  /** Adds the form's quantity of this product / variation; WooCommerce's message if it can't. */
  const add = (form: HTMLFormElement, variationId: number | null) => {
    const quantity = Number(new FormData(form).get("quantity")) || 1;
    startAdding(async () => {
      const result = await addToCart(productId, variationId, quantity);
      announceCartChange();
      if (result.ok) chrome.open("cart");
      else window.alert(result.error);
    });
  };
  const [selection, setSelection] = useState<Selection>(() =>
    form.type === "variable" ? Object.fromEntries(form.attributes.filter((a) => a.default).map((a) => [a.name, a.default!])) : {},
  );

  if (form.type === "none") return null;

  if (form.type === "simple") {
    return (
      <>
        {/* WooCommerce's availability (wc_get_stock_html) for a product set to "Allow, but notify customer". */}
        {BACKORDER[String(productId)]?.notify ? <BackorderStock /> : null}
      <form
        className="cart"
        onSubmit={(event) => {
          event.preventDefault();
          add(event.currentTarget, null);
        }}
      >
        <Quantity label={productName} />
        <button type="submit" className={`single_add_to_cart_button button alt${adding ? " loading" : ""}`} disabled={adding}>
          Add to cart
        </button>
      </form>
      </>
    );
  }

  const allPicked = form.attributes.every((a) => selection[a.name]);
  const chosen = allPicked ? variations.find((v) => matches(v, selection)) : undefined;
  const purchasable = Boolean(chosen?.inStock);

  const choose = (name: string, value: string) => {
    const next = { ...selection, [name]: value };
    setSelection(next);
    const complete = form.attributes.every((a) => next[a.name]);
    const variation = complete ? variations.find((v) => matches(v, next)) : undefined;
    gallery.showVariation(variation ?? null);
  };
  const clear = () => {
    setSelection({});
    gallery.showVariation(null);
  };

  return (
    // The theme's layout options (see product.css). "variation-swatch-selected" shows "Clear":
    // on the live page that happens once every option is chosen.
    <form
      className={`variations_form cart wd-price-outside wd-reset-side-lg wd-reset-bottom-md wd-label-top-md${allPicked ? " variation-swatch-selected" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen?.inStock) add(event.currentTarget, chosen.id);
      }}
    >
      <table className="variations" role="presentation">
        <tbody>
          {form.attributes.map((attribute, index) => {
            const id = attribute.name.replace(/^attribute_/, "");
            const isLast = index === form.attributes.length - 1;
            const picked = attribute.options.find((option) => option.value === selection[attribute.name]);
            return (
              <tr key={attribute.name}>
                <th className="label cell">
                  <label htmlFor={id}>{attribute.label}</label>
                  {/* The picked pill's name; shown on screens up to 768px only (product.css). */}
                  {attribute.swatches && picked ? <span className="wd-attr-selected">{picked.label}</span> : null}
                </th>
                <td className={`value cell${attribute.swatches ? " with-swatches" : ""}`}>
                  {attribute.swatches ? (
                    <div
                      className="wd-swatches-product wd-swatches-single wd-bg-style-1 wd-text-style-1 wd-dis-style-1 wd-size-default wd-shape-round"
                      data-id={id}
                      role="radiogroup"
                      aria-label={attribute.label}
                    >
                      {attribute.options.map((option) => {
                        const active = selection[attribute.name] === option.value;
                        return (
                          <div
                            key={option.value}
                            className={`wd-swatch wd-text${active ? " wd-active" : ""}`}
                            data-value={option.value}
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            tabIndex={0}
                            onClick={() => choose(attribute.name, active ? "" : option.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                choose(attribute.name, active ? "" : option.value);
                              }
                            }}
                          >
                            <span className="wd-swatch-text">{option.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {/* WooCommerce prints a space here: when the pills fill the row, "Clear" wraps
                      onto its own line (visible in the quick-view popup). */}{" "}
                  <select id={id} name={attribute.name} value={selection[attribute.name] ?? ""} onChange={(event) => choose(attribute.name, event.target.value)}>
                    <option value="">Choose an option</option>
                    {attribute.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {/* WooCommerce adds "Clear" after the last option only. */}
                  {isLast ? (
                    <div className="wd-reset-var">
                      <a
                        className="reset_variations"
                        href="#"
                        aria-label="Clear options"
                        onClick={(event) => {
                          event.preventDefault();
                          clear();
                        }}
                      >
                        Clear
                      </a>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="single_variation_wrap">
        {/* WooCommerce's variation box: hidden until a variation is chosen. Its price is hidden too
            (the theme's "price outside" form shows it in the summary's main price, SummaryPrice),
            so only an "Out of stock" message can be seen here. */}
        <div className="woocommerce-variation single_variation" role="alert" aria-relevant="additions" style={chosen ? undefined : { display: "none" }}>
          {chosen ? (
            <>
              <div className="woocommerce-variation-description" />
              <div className="woocommerce-variation-price">
                <span className="price">
                  <WooPrice min={chosen.price} max={chosen.price} regular={chosen.regularPrice} />
                </span>
              </div>
              <div className="woocommerce-variation-availability">
                {chosen.inStock ? (
                  BACKORDER[String(chosen.id)]?.notify ? <BackorderStock /> : null
                ) : (
                  <p className="stock out-of-stock wd-style-bordered">
                    <span>Out of stock</span>
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
        {/* WooCommerce's state classes: nothing chosen yet → "selection needed"; the chosen
            variation is out of stock → "unavailable". */}
        <div className={`woocommerce-variation-add-to-cart variations_button woocommerce-variation-add-to-cart-${purchasable ? "enabled" : "disabled"}`}>
          <Quantity label={productName} />
          <button
            type="submit"
            className={`single_add_to_cart_button button alt${purchasable ? "" : chosen ? " disabled wc-variation-is-unavailable" : " disabled wc-variation-selection-needed"}${adding ? " loading" : ""}`}
            onClick={() => {
              if (!chosen) window.alert("Please select some product options before adding this product to your cart.");
              else if (!chosen.inStock) window.alert("Sorry, this product is unavailable. Please choose a different combination.");
            }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </form>
  );
}
