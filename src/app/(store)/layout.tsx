/**
 * Layout for every public store page (the "(store)" folder name doesn't appear in URLs).
 * It adds what the live site shows on every page: top bar + header, footer, the cart drawer,
 * mobile menu, search overlay, cookie bar, floating cart and WhatsApp buttons. (The age gate and the
 * "5% off" popups are on the homepage only, as on the live site: src/app/(store)/page.tsx.)
 * Sanity Studio (/studio/) lives outside this group, so it gets none of this.
 */
import "@/styles/site-chrome.css";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { ChromeProvider } from "@/components/layout/ChromeProvider";
import { CookieNotice } from "@/components/layout/CookieNotice";
import { FloatingButtons } from "@/components/layout/FloatingButtons";
import { SiteFooter } from "@/components/layout/footer/SiteFooter";
import { SiteHeader } from "@/components/layout/header/SiteHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { ThirdPartyScripts } from "@/components/layout/ThirdPartyScripts";
import { getSiteChrome } from "@/lib/content/sanity";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  // Top bar, menu, footer and cookie bar: Sanity's Site settings when the site reads Sanity
  // (src/lib/content/sanity.ts), else the copy of the live site in src/content/site-chrome.ts.
  const chrome = await getSiteChrome();
  return (
    <ChromeProvider>
      <SiteHeader announcements={chrome.announcements} menu={chrome.mainMenu} />
      <div className="store-content">{children}</div>
      <SiteFooter footer={chrome.footer} />
      <SearchOverlay />
      <CartDrawer />
      <MobileNav menu={chrome.mainMenu} />
      <FloatingButtons />
      <CookieNotice cookieNotice={chrome.cookieNotice} />
      <ThirdPartyScripts />
    </ChromeProvider>
  );
}
