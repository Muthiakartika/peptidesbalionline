"use client";

/**
 * Left-hand mobile menu drawer (≤1024px): search box (with suggestions), the main menu as cards with expandable
 * sub-menus, "Login / Register", and the rotating payment badge. Styles: ".mobile-nav" in
 * src/styles/site-chrome.css (from the live site's snippet 18-mobile-navigation).
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { useChrome } from "./ChromeProvider";
import { PaymentBadge } from "./header/PaymentBadge";
import { AliasNotice } from "./search/AliasNotice";
import { SearchSuggestions } from "./search/SearchSuggestions";
import { useSearchSuggestions } from "./search/useSearchSuggestions";
import { Icon } from "@/components/ui/Icon";
import { mainMenu, type NavLink } from "@/content/site-chrome";

function MenuItem({ item, nested, onNavigate }: { item: NavLink; nested?: boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="mobile-nav__item" data-open={open}>
      <div className="mobile-nav__row">
        <Link href={item.href} className={nested ? "mobile-nav__sublink" : "mobile-nav__link"} onClick={onNavigate}>
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- 18px thumbnails, same files as the live menu
            <img src={item.image} alt={item.label} width={150} height={150} loading="lazy" />
          ) : null}
          {item.label}
        </Link>
        {item.children ? (
          <button type="button" className="mobile-nav__opener" aria-label={`Open ${item.label} sub-menu`} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="chevronRight" />
          </button>
        ) : null}
      </div>
      {item.children && open ? (
        <ul className="mobile-nav__sub">
          {item.children.map((child) => (
            <MenuItem key={child.href} item={child} nested onNavigate={onNavigate} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The menu's search box, as Woodmart's AJAX search in the live mobile menu: from 3 typed characters
 * the suggestions open in a list under the box (it pushes the menu down, at most half the screen
 * tall, then it scrolls), with the owner's compound-name note on top ("reta" → GLP-3 RTA) and "View
 * all results" at the end. A × clears the box (the cursor stays in it) once something is typed.
 */
function MobileSearch({ onNavigate }: { onNavigate: () => void }) {
  const { result, loading, search } = useSearchSuggestions();
  const [typed, setTyped] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const type = (value: string) => {
    setTyped(value);
    search(value);
  };
  const clear = () => {
    if (input.current) input.current.value = "";
    type("");
    input.current?.focus();
  };
  return (
    <div className="mobile-nav__search-area" data-searched={result !== null || undefined}>
      <form role="search" method="get" action="/" className="mobile-nav__search" data-loading={loading || undefined} autoComplete="off">
        <input ref={input} type="text" name="s" required placeholder="Search for products" aria-label="Search" title="Search for products" onChange={(event) => type(event.target.value)} />
        <input type="hidden" name="post_type" value="product" />
        {typed ? (
          <span
            tabIndex={0}
            role="button"
            aria-label="Clear search"
            className="mobile-nav__clear"
            onClick={clear}
            onKeyDown={(event) => {
              if (event.key === "Enter") clear();
            }}
          />
        ) : null}
        <button type="submit" aria-label="Search">
          <Icon name="search" />
        </button>
      </form>
      {result ? (
        <div className="mobile-nav__results">
          <div className="mobile-nav__results-scroll">
            <AliasNotice query={typed} onNavigate={onNavigate} />
            <SearchSuggestions result={result} onNavigate={onNavigate} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MobileNav({ menu = mainMenu }: { menu?: NavLink[] }) {
  const { openPanel, close } = useChrome();
  const isOpen = openPanel === "menu";
  return (
    <>
      <div className="side-overlay" data-open={isOpen} onClick={close} aria-hidden="true" />
      <aside className="side-drawer side-drawer--left mobile-nav" data-open={isOpen} aria-label="Mobile menu" aria-hidden={!isOpen} inert={!isOpen}>
        <div className="side-drawer__heading">
          <button type="button" className="side-drawer__close" onClick={close}>
            <Icon name="close" />
            Close
          </button>
        </div>
        <MobileSearch onNavigate={close} />
        <ul className="mobile-nav__list">
          {menu.map((item) => (
            <MenuItem key={item.href} item={item} onNavigate={close} />
          ))}
          <li className="mobile-nav__item">
            <Link href="/my-account/" className="mobile-nav__link mobile-nav__account" onClick={close}>
              <Icon name="account" />
              Login / Register
            </Link>
          </li>
        </ul>
        <div className="mobile-nav__extra">
          <PaymentBadge />
        </div>
      </aside>
    </>
  );
}
