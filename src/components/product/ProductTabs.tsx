"use client";

/**
 * Description / custom tabs under the product summary (Woodmart "tabs" layout). On desktop the
 * titles are a row of pill tabs; on phones the same panels become an accordion, like the live site.
 */
import { useState } from "react";

import { LegacyHtml } from "./LegacyHtml";

export type CleanTab = { key: string; title: string; html: string };

export function ProductTabs({ tabs }: { tabs: CleanTab[] }) {
  const [active, setActive] = useState<string | undefined>(tabs[0]?.key);
  if (tabs.length === 0) return null;
  return (
    <div className="product-tabs-wrapper">
      <div className="container product-tabs-inner">
        <div className="woocommerce-tabs wc-tabs-wrapper tabs-layout-tabs wd-opener-pos-right wd-opener-style-arrow">
          <div className="wd-nav-wrapper wd-nav-tabs-wrapper text-center">
            <ul className="wd-nav wd-nav-tabs tabs wc-tabs wd-style-underline-reverse" role="tablist">
              {tabs.map((tab) => (
                <li key={tab.key} className={`${tab.key}_tab${tab.key === active ? " active" : ""}`} id={`tab-title-${tab.key}`} role="presentation">
                  <a
                    className="wd-nav-link"
                    href={`#tab-${tab.key}`}
                    role="tab"
                    aria-controls={`tab-${tab.key}`}
                    aria-selected={tab.key === active}
                    onClick={(event) => {
                      event.preventDefault();
                      setActive(tab.key);
                    }}
                  >
                    <span className="nav-link-text wd-tabs-title">{tab.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {tabs.map((tab) => {
            const open = tab.key === active;
            return (
              <div key={tab.key} className="wd-accordion-item">
                <div
                  className={`wd-accordion-title tab-title-${tab.key} wd-role-btn${open ? " wd-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setActive(open ? undefined : tab.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActive(open ? undefined : tab.key);
                    }
                  }}
                >
                  <div className="wd-accordion-title-text">
                    <span>{tab.title}</span>
                  </div>
                  <span className="wd-accordion-opener" />
                </div>
                <div
                  className={`entry-content woocommerce-Tabs-panel woocommerce-Tabs-panel--${tab.key} panel wc-tab${open ? " wd-active" : ""}`}
                  id={`tab-${tab.key}`}
                  role="tabpanel"
                  aria-labelledby={`tab-title-${tab.key}`}
                >
                  <LegacyHtml className="wc-tab-inner wd-entry-content" html={tab.html} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
