"use client";

/** The clickable icons in the header that open an overlay: search, cart and the mobile menu. */
import Link from "next/link";
import { useChrome } from "@/components/layout/ChromeProvider";
import { Icon } from "@/components/ui/Icon";
import { useCartCount } from "@/lib/commerce/useCartCount";

export function SearchButton() {
  const { openPanel, toggle } = useChrome();
  const isOpen = openPanel === "search";
  return (
    <button type="button" className="header-tool" aria-label={isOpen ? "Close search form" : "Search"} aria-expanded={isOpen} onClick={() => toggle("search")}>
      <Icon name={isOpen ? "close" : "search"} />
    </button>
  );
}

/** The count comes from the cart cookie once the page has loaded (useCartCount). */
export function CartButton() {
  const { open } = useChrome();
  const count = useCartCount();
  return (
    <Link
      href="/cart/"
      title="Shopping cart"
      className="header-tool header-tool--cart"
      onClick={(event) => {
        event.preventDefault();
        open("cart");
      }}
    >
      <span className="header-tool__icon">
        <Icon name="cart" />
        <span className="cart-count">
          {count} <span className="sr-only">{count === 1 ? "item" : "items"}</span>
        </span>
      </span>
    </Link>
  );
}

export function MenuButton() {
  const { open } = useChrome();
  return (
    <button type="button" className="header-tool" aria-label="Open mobile menu" onClick={() => open("menu")}>
      <Icon name="menu" />
    </button>
  );
}
