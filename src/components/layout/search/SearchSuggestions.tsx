"use client";

/**
 * The results grid under the full-screen search input: matching categories, then products, each
 * product with the owner's "search buy" controls (option pills + button), as on the live site.
 * Styles: ".search-suggestions" in src/styles/site-chrome.css.
 */
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";

import { addToCart } from "@/app/(store)/cart/actions";
import { formatUsd } from "@/lib/catalog/usd";
import { announceCartChange } from "@/lib/commerce/useCartCount";
import { formatMoney } from "@/lib/money";
import { struckRegular } from "@/lib/catalog/sale";

import type { SuggestionProduct, SuggestionResponse } from "./suggestion-types";

/** Underlines every occurrence of the typed text in a title (Woodmart's highlight). */
function highlight(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const pattern = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")})`, "gi");
  return text.split(pattern).map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>));
}

function PriceHtml({ min, max, regular }: { min: bigint; max: bigint; regular?: string }) {
  const was = struckRegular(min, max, regular);
  if (was !== null) {
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
  return (
    <>
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

type Selection = Record<string, string>;
const matches = (attributes: Record<string, string>, selection: Selection) =>
  Object.entries(selection).every(([key, value]) => !value || !attributes[key] || attributes[key] === value);

/**
 * The button and message of the owner's "Atlas search buy" controls, as the live script does it:
 * "Adding…", then "Added ✓" with "Added to cart" in green (or "Unable to add this option to the
 * cart."), and 1.4 seconds later the button reads "Add to cart" (without "+": live does that too).
 * The cart counts in the header follow. (Live then also fires WooCommerce's "added_to_cart" event; whether
 * Woodmart opens the side cart over the search wasn't captured, so it stays closed here.)
 */
function SearchAdd({ productId, variationId, label, disabled = false }: { productId: number; variationId: number | null; label: string; disabled?: boolean }) {
  const [state, setState] = useState<{ text: string | null; feedback: string; success: boolean; busy: boolean }>({ text: null, feedback: "", success: false, busy: false });
  // A new choice of options gives the button its label back, as the live script's update().
  const [shownLabel, setShownLabel] = useState(label);
  if (shownLabel !== label) {
    setShownLabel(label);
    setState((current) => ({ ...current, text: null }));
  }
  const add = async () => {
    setState({ text: "Adding…", feedback: "", success: false, busy: true });
    let next: { text: string; feedback: string; success: boolean };
    try {
      const result = await addToCart(productId, variationId, 1);
      announceCartChange();
      next = result.ok ? { text: "Added ✓", feedback: "Added to cart", success: true } : { text: "Add to cart", feedback: "Unable to add this option to the cart.", success: false };
    } catch {
      next = { text: "Add to cart", feedback: "Server error", success: false };
    }
    setState({ ...next, busy: true });
    window.setTimeout(() => setState((current) => ({ ...current, text: "Add to cart", busy: false })), 1400);
  };
  return (
    <>
      <button type="button" className="search-buy__add" disabled={disabled || state.busy} onClick={add}>
        {state.text ?? label}
      </button>
      <p className={`search-buy__feedback${state.success ? " is-success" : ""}`} aria-live="polite">
        {state.feedback}
      </p>
    </>
  );
}

/** The owner's "Atlas search buy" controls (inline snippet on the live site). */
function SearchBuy({ product }: { product: SuggestionProduct }) {
  // Attributes with a single option start selected, like the live snippet.
  const [selection, setSelection] = useState<Selection>(() =>
    Object.fromEntries(product.options.filter((a) => a.options.length === 1).map((a) => [a.name, a.options[0].value])),
  );
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  if (product.type === "simple") {
    return (
      <div className="search-buy" onClick={stop} onPointerDown={stop}>
        <SearchAdd productId={product.id} variationId={null} label="+ Add to cart" />
      </div>
    );
  }

  const allPicked = product.options.every((a) => selection[a.name]);
  const chosen = allPicked ? product.variations.find((v) => matches(v.attributes, selection)) : undefined;

  return (
    <div className="search-buy" onClick={stop} onPointerDown={stop}>
      {product.options.map((attribute) => (
        <div key={attribute.name} className="search-buy__field">
          <span className="search-buy__field-name">{attribute.label}</span>
          <div className="search-buy__options">
            {attribute.options.map((option) => {
              const trial = { ...selection, [attribute.name]: option.value };
              const available = product.variations.some((v) => matches(v.attributes, trial));
              const active = selection[attribute.name] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="search-buy__option"
                  data-selected={active || undefined}
                  aria-pressed={active}
                  disabled={!available}
                  onClick={() => setSelection((current) => ({ ...current, [attribute.name]: current[attribute.name] === option.value ? "" : option.value }))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="search-buy__price">{chosen ? <PriceHtml min={BigInt(chosen.price)} max={BigInt(chosen.price)} regular={chosen.regularPrice} /> : null}</div>
      <SearchAdd productId={product.id} variationId={chosen?.id ?? null} label={chosen ? "+ Add selected option" : "Choose options"} disabled={!chosen} />
    </div>
  );
}

export function SearchSuggestions({ result, onNavigate }: { result: SuggestionResponse; onNavigate: () => void }) {
  const { query, categories, products } = result;
  return (
    <div className="search-suggestions" key={query}>
      {categories.length > 0 ? (
        <>
          <div className="search-suggestions__title">Categories</div>
          <div className="search-suggestions__group search-suggestions__group--categories">
            {categories.map((category) => (
              <div key={category.path} className="suggestion">
                {category.image ? (
                  <div className="suggestion__thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the live site's category thumbnail */}
                    <img src={category.image.src} srcSet={category.image.srcset} sizes={category.image.sizes} width={category.image.width} height={category.image.height} alt={category.image.alt} />
                  </div>
                ) : null}
                <div className="suggestion__content">
                  <div className="suggestion__title">{highlight(category.name, query)}</div>
                </div>
                <Link className="suggestion__link" href={category.path} aria-label={category.name} onClick={onNavigate} />
              </div>
            ))}
          </div>
          {products.length > 0 ? <div className="search-suggestions__title">Products</div> : null}
        </>
      ) : null}
      <div className="search-suggestions__group search-suggestions__group--products">
        {products.length === 0 ? (
          <div className="suggestion suggestion--not-found">
            <span className="suggestion__not-found">No products found</span>
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="suggestion">
              {product.image ? (
                <div className="suggestion__thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the live site's 300×300 search thumbnail */}
                  <img src={product.image.src} srcSet={product.image.srcset} sizes={product.image.sizes} width={product.image.width} height={product.image.height} alt={product.image.alt} loading="lazy" decoding="async" />
                </div>
              ) : null}
              <div className="suggestion__content">
                <div className="suggestion__title">{highlight(product.name, query)}</div>
                <p className="price">
                  <PriceHtml min={BigInt(product.priceMin)} max={BigInt(product.priceMax)} regular={product.regularPrice} />
                </p>
                <SearchBuy product={product} />
              </div>
              <Link className="suggestion__link" href={product.path} aria-label={product.name} onClick={onNavigate} />
            </div>
          ))
        )}
      </div>
      {/* Woodmart's link to the whole result list, under the suggestions when any product matches. */}
      {products.length > 0 ? (
        <Link className="search-suggestions__all" href={`/?${new URLSearchParams({ s: query, post_type: "product" }).toString()}`} onClick={onNavigate}>
          View all results
        </Link>
      ) : null}
    </div>
  );
}
