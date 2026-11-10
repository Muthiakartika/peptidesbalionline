/**
 * The header on every store page: gold top bar + white floating pill.
 *
 *   Desktop (≥1025px): logo | main menu | payment badge, flags, search, account, cart
 *   Mobile (≤1024px):  logo | flags, search, cart, menu button
 *
 * Measurements and styles: src/styles/site-chrome.css (".header-pill" and friends).
 */
import Link from "next/link";

import type { Announcement, NavLink } from "@/content/site-chrome";

import { AccountMenu } from "./AccountMenu";
import { CartButton, MenuButton, SearchButton } from "./HeaderButtons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MainNav } from "./MainNav";
import { PaymentBadge } from "./PaymentBadge";
import { StickyHeader } from "./StickyHeader";
import { TopBar } from "./TopBar";

function Logo({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <div className={`site-logo site-logo--${variant} header-cell`}>
      <Link href="/" rel="home" aria-label="Site logo" className="block h-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo must keep its exact natural size */}
        <img src="/brand/atlas-longevity-logo.png" alt="" width={700} height={356} />
      </Link>
    </div>
  );
}

export function SiteHeader({ announcements, menu }: { announcements?: Announcement[]; menu?: NavLink[] }) {
  return (
    <StickyHeader>
      <TopBar items={announcements} />
      <div className="header-pill-slot">
        <div className="header-pill">
          {/* Desktop row */}
          <div className="header-pill__inner only-desktop">
            <div className="header-col header-col--left">
              <Logo variant="desktop" />
            </div>
            <div className="header-col header-col--center">
              <MainNav menu={menu} />
            </div>
            <div className="header-col header-col--right">
              <div className="header-cell">
                <PaymentBadge />
              </div>
              <div className="header-cell">
                <LanguageSwitcher widgetId="84055914" />
              </div>
              <SearchButton />
              <AccountMenu />
              <CartButton />
            </div>
          </div>

          {/* Mobile row */}
          <div className="header-pill__inner only-mobile">
            <div className="header-col header-col--left">
              <Logo variant="mobile" />
            </div>
            <div className="header-col header-col--right">
              <div className="header-cell">
                <LanguageSwitcher widgetId="48694965" />
              </div>
              <SearchButton />
              <CartButton />
              <MenuButton />
            </div>
          </div>
        </div>
      </div>
    </StickyHeader>
  );
}
