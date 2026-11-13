/**
 * The product's description and custom tabs (WooCommerce "tabs"), shown one after another as
 * sections of the page instead of tabs (redesign of 12 Nov 2026: every page one continuous page).
 *
 *   * A description that is a designed Elementor page is shown as it is, in the page's container (its
 *     stretched sections still run across the screen).
 *   * A description written as plain text (headings, paragraphs, lists, tables) becomes an article:
 *     a heading and the list of its H2s on the left, the text in a reading column (ProductArticle).
 *   * The other tabs ("Benefits", …) get a small heading on the left and their text on the right.
 *
 * Each section keeps its old tab id (#tab-description, #tab-wd_custom_tab), so old links to a tab
 * still land on it.
 */
import { withHeadingIds, withTableBoxes } from "@/lib/blog/article-html";

import { LegacyHtml } from "./LegacyHtml";
import { ProductArticle } from "./ProductArticle";

export type CleanTab = { key: string; title: string; html: string };

/** A description built with Elementor (its own designed sections) rather than written as plain text. */
const isDesigned = (html: string) => /\bclass="[^"]*\belementor\b/.test(html);

export function ProductSections({ tabs, productName }: { tabs: CleanTab[]; productName: string }) {
  if (tabs.length === 0) return null;
  return (
    <div className="pp-sections">
      {tabs.map((tab) => {
        if (tab.key === "description" && isDesigned(tab.html)) {
          return (
            <section key={tab.key} id={`tab-${tab.key}`} className="pp-section pp-section--description woocommerce-Tabs-panel--description" aria-label={`About ${productName}`}>
              {/* In the page's container, as in the old tabs: the description's "stretched" sections still
                  run across the screen (their own 100vw), the others keep the content width. */}
              <div className="container pp-designed">
                <LegacyHtml className="wc-tab-inner wd-entry-content" html={tab.html} />
              </div>
            </section>
          );
        }
        if (tab.key === "description") {
          const { html, headings } = withHeadingIds(withTableBoxes(tab.html));
          return (
            <section key={tab.key} id={`tab-${tab.key}`} className="pp-section pp-section--article woocommerce-Tabs-panel--description" aria-label={`About ${productName}`}>
              <ProductArticle html={html} headings={headings} productName={productName} />
            </section>
          );
        }
        return (
          <section key={tab.key} id={`tab-${tab.key}`} className="pp-section pp-section--tab" aria-labelledby={`tab-title-${tab.key}`}>
            <div className="pp-wrap">
              <header className="pp-head">
                <p className="pp-eyebrow">{productName}</p>
                <h2 className="pp-title" id={`tab-title-${tab.key}`}>
                  {tab.title}
                </h2>
              </header>
              <LegacyHtml className="pp-panel wc-tab-inner wd-entry-content" html={tab.html} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
