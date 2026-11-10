"use client";

/**
 * The cart page's interactive parts (the rest of the page is rendered on the server):
 *   * CartNotices: WooCommerce's messages at the top ("“KPV 10mg” removed. Undo?"), kept while the
 *     page is rendered again after a change;
 *   * RemoveItem: the × in the first column;
 *   * CartQuantity: the − / number / + box. Like the live cart (its "Update cart" button is hidden), a
 *     change is saved by itself shortly after the last click;
 *   * TopUpAdd: "+ Add" in "Top up your supplies".
 * Each one calls a Server Action (src/app/(store)/cart/actions.ts); Next.js then renders the page again.
 */
import { createContext, useContext, useId, useRef, useState, useTransition, type ReactNode } from "react";

import { addToCart, removeCartCoupon, removeFromCart, setCartQuantity } from "@/app/(store)/cart/actions";
import { announceCartChange } from "@/lib/commerce/useCartCount";

type Notice = { id: number; kind: "message" | "error"; text: string; undo?: () => void };

type NewNotice = Omit<Notice, "id">;
const NoticesContext = createContext<{ notices: Notice[]; show: (notice: NewNotice | NewNotice[]) => void; clear: () => void } | null>(null);

/** wc_print_notices lists errors first, then messages. */
const inPrintOrder = (list: NewNotice[]) => [...list.filter((n) => n.kind === "error"), ...list.filter((n) => n.kind === "message")];

/** The coupon notices a cart change returned (coupons it made invalid), as errors. */
const couponErrors = (texts: string[] | undefined): NewNotice[] => (texts ?? []).map((text) => ({ kind: "error", text }));

export function CartNoticesProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const next = useRef(0);
  const value = {
    notices,
    show: (notice: NewNotice | NewNotice[]) => setNotices(inPrintOrder(Array.isArray(notice) ? notice : [notice]).map((n) => ({ ...n, id: ++next.current }))),
    clear: () => setNotices([]),
  };
  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>;
}

export function useCartNotices() {
  const context = useContext(NoticesContext);
  if (!context) throw new Error("Cart controls must be inside <CartNoticesProvider>");
  return context;
}

/** WooCommerce's notices wrapper with this page's messages (and the server's, e.g. out of stock). */
export function CartNotices({ serverErrors = [] }: { serverErrors?: string[] }) {
  const { notices } = useCartNotices();
  return (
    <div className="woocommerce-notices-wrapper">
      {notices.map((notice) =>
        notice.kind === "message" ? (
          <div key={notice.id} className="woocommerce-message" role="alert">
            {notice.text}{" "}
            {notice.undo ? (
              <a
                href="#"
                className="restore-item"
                onClick={(event) => {
                  event.preventDefault();
                  notice.undo?.();
                }}
              >
                Undo?
              </a>
            ) : null}
          </div>
        ) : (
          <ul key={notice.id} className="woocommerce-error" role="alert">
            <li>{notice.text}</li>
          </ul>
        ),
      )}
      {serverErrors.length ? (
        <ul className="woocommerce-error" role="alert">
          {serverErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RemoveItem({ lineKey, productId, variationId, quantity, name }: { lineKey: string; productId: number; variationId: number | null; quantity: number; name: string }) {
  const { show, clear } = useCartNotices();
  const [pending, startTransition] = useTransition();
  return (
    <a
      role="button"
      href="#"
      className="remove"
      aria-label={`Remove ${name} from cart`}
      data-product_id={productId}
      data-product_sku=""
      aria-disabled={pending || undefined}
      onClick={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await removeFromCart(lineKey);
          announceCartChange();
          show([
            ...couponErrors(result.ok ? result.couponNotices : []),
            {
              kind: "message",
              text: `“${name}” removed.`,
              undo: () =>
                startTransition(async () => {
                  const restored = await addToCart(productId, variationId, quantity);
                  announceCartChange();
                  const errors = couponErrors(restored.ok ? restored.couponNotices : []);
                  if (errors.length) show(errors);
                  else clear();
                }),
            },
          ]);
        });
      }}
    >
      ×
    </a>
  );
}

export function CartQuantity({ lineKey, name, quantity }: { lineKey: string; name: string; quantity: number }) {
  const id = useId();
  const { show, clear } = useCartNotices();
  const [value, setValue] = useState(String(quantity));
  const [serverQuantity, setServerQuantity] = useState(quantity);
  const [, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  // The server's quantity wins after the page is rendered again.
  if (serverQuantity !== quantity) {
    setServerQuantity(quantity);
    setValue(String(quantity));
  }

  const save = (text: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = Number(text);
      if (!Number.isInteger(next) || next < 0 || next === quantity) return;
      startTransition(async () => {
        const result = await setCartQuantity(lineKey, next);
        announceCartChange();
        if (result.ok) {
          const errors = couponErrors(result.couponNotices);
          if (next === 0) show([...errors, { kind: "message", text: `“${name}” removed.` }]);
          else if (errors.length) show(errors);
          else clear();
        } else show({ kind: "error", text: result.error });
      });
    }, 600);
  };
  const change = (text: string) => {
    setValue(text);
    save(text);
  };

  return (
    <div className="quantity">
      <input type="button" value="-" className="minus btn" aria-label="Decrease quantity" onClick={() => change(String(Math.max(0, Number(value) - 1)))} />
      <label className="screen-reader-text" htmlFor={id}>
        {name} quantity
      </label>
      <input
        type="number"
        id={id}
        className="input-text qty text"
        value={value}
        aria-label="Product quantity"
        min={0}
        step={1}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => change(event.target.value)}
      />
      <input type="button" value="+" className="plus btn" aria-label="Increase quantity" onClick={() => change(String(Number(value) + 1))} />
    </div>
  );
}

/**
 * "[Remove]" after a coupon in the cart totals (wc_cart_totals_coupon_html, cart.js remove_coupon_clicked):
 * removes it, then "Coupon has been removed." at the top and the totals again. A link to
 * /cart/?remove_coupon=… still works before the page's script runs (src/proxy.ts). Space works as on a
 * button, as WooCommerce's role="button" link does.
 */
export function CartRemoveCoupon({ code }: { code: string }) {
  const { show } = useCartNotices();
  const [pending, startTransition] = useTransition();
  return (
    <RemoveCouponLink
      code={code}
      href={`/cart/?remove_coupon=${encodeURIComponent(code)}`}
      busy={pending}
      onRemove={() =>
        startTransition(async () => {
          const result = await removeCartCoupon(code);
          show({ kind: result.ok ? "message" : "error", text: result.notice });
        })
      }
    />
  );
}

/** The link itself, shared with the checkout's totals. */
export function RemoveCouponLink({ code, href, busy, onRemove }: { code: string; href: string; busy?: boolean; onRemove: () => void }) {
  return (
    <a
      role="button"
      aria-label={`Remove ${code} coupon`}
      href={href}
      className="woocommerce-remove-coupon"
      data-coupon={code}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        event.preventDefault();
        if (!busy) onRemove();
      }}
      onKeyDown={(event) => {
        if (event.key === " ") {
          event.preventDefault();
          if (!busy) onRemove();
        }
      }}
    >
      [Remove]
    </a>
  );
}

/** The cart table's form. Its changes are saved by the controls above, so Enter in a field sends nothing. */
export function CartForm({ children }: { children: ReactNode }) {
  return (
    <form className="woocommerce-cart-form" action="/cart/" method="post" onSubmit={(event) => event.preventDefault()}>
      {children}
    </form>
  );
}

/** "+ Add" of a simple product in "Top up your supplies": adds one, as the live AJAX button does. */
export function TopUpAdd({ productId, name }: { productId: number; name: string }) {
  const { show } = useCartNotices();
  const [state, setState] = useState<"" | "loading" | "added">("");
  return (
    <a
      href={`/cart/?add-to-cart=${productId}`}
      data-quantity="1"
      data-product_id={productId}
      data-product_sku=""
      className={` button add_to_cart_button ajax_add_to_cart sleeks-topup-add ${state}`}
      aria-label={`Add ${name} to your cart`}
      onClick={async (event) => {
        event.preventDefault();
        setState("loading");
        const result = await addToCart(productId, null, 1);
        announceCartChange();
        if (result.ok) {
          setState("added");
          if (result.couponNotices?.length) show(couponErrors(result.couponNotices));
        } else {
          setState("");
          show({ kind: "error", text: result.error });
        }
      }}
    >
      <span aria-hidden="true">+</span> Add
    </a>
  );
}
