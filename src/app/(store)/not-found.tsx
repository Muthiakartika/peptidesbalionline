/**
 * 404 page, same text and layout as the live WordPress 404 (Woodmart theme).
 * Styles: ".error-404" in src/styles/site-chrome.css.
 */
import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Page Not Found - Atlas Longevity",
};

export default function NotFound() {
  return (
    <main id="main-content" className="wd-container error-404">
      <header className="error-404__header">
        <h3 className="error-404__title">Not Found</h3>
      </header>
      <div className="error-404__content">
        <h1 className="error-404__h1">This is somewhat embarrassing, isn’t it?</h1>
        <p className="error-404__text">It looks like nothing was found at this location. Maybe try a search?</p>
        <form role="search" method="get" action="/" className="error-404__search" autoComplete="off">
          <input type="text" name="s" required placeholder="Search for posts" aria-label="Search" title="Search for posts" />
          <input type="hidden" name="post_type" value="post" />
          <button type="submit" aria-label="Search">
            <Icon name="search" />
          </button>
        </form>
      </div>
    </main>
  );
}
