"use client";

/**
 * A product description written as plain text (headings, paragraphs, lists, tables; not a designed
 * Elementor page), shown as an article (12 Nov 2026: such descriptions ran edge to edge):
 *
 *   ┌ "Product details" · About <product> · contents (the H2s) │ the text in a reading column ┐
 *
 * A long text is shown folded (about 1000px) with "Read the full description"; following a link in
 * the contents, or an address that points into the text, opens it first. The headings get their ids
 * on the server (withHeadingIds in src/lib/blog/article-html.ts). Styles: src/styles/product-page.css.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { ArticleHeading } from "@/lib/blog/article-html";

import { LegacyHtml } from "./LegacyHtml";

/** Texts taller than this are folded. */
const FOLD_ABOVE = 1400;

export function ProductArticle({ html, headings, productName }: { html: string; headings: ArticleHeading[]; productName: string }) {
  const body = useRef<HTMLDivElement>(null);
  const [foldable, setFoldable] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = body.current;
    if (!element) return;
    setFoldable(element.scrollHeight > FOLD_ABOVE);
  }, [html]);

  /** Opens the text and scrolls to one of its headings. */
  const goTo = useCallback((id: string) => {
    setOpen(true);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  // An address like /product/x/#mechanism-of-action, or the browser's back/forward to one.
  useEffect(() => {
    const openForHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && body.current?.querySelector(`[id="${CSS.escape(id)}"]`)) goTo(id);
    };
    openForHash();
    window.addEventListener("hashchange", openForHash);
    return () => window.removeEventListener("hashchange", openForHash);
  }, [goTo]);

  const folded = foldable && !open;
  return (
    <div className="pp-wrap pp-article">
      <aside className="pp-article__aside">
        <p className="pp-eyebrow">Product details</p>
        <h2 className="pp-title">About {productName}</h2>
        {headings.length > 1 ? (
          <nav className="pp-toc" aria-label="In this description">
            <p className="pp-toc__label">In this description</p>
            <ol>
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      history.replaceState(null, "", `#${heading.id}`);
                      goTo(heading.id);
                    }}
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </aside>
      <div className="pp-article__main">
        <div ref={body} id="pp-article-body" className="pp-article__body" data-folded={folded || undefined}>
          <LegacyHtml className="pp-prose wc-tab-inner wd-entry-content" html={html} />
        </div>
        {foldable ? (
          <button
            type="button"
            className="pp-article__toggle"
            aria-expanded={open}
            aria-controls="pp-article-body"
            onClick={() => {
              if (open) document.getElementById("tab-description")?.scrollIntoView({ behavior: "smooth", block: "start" });
              setOpen(!open);
            }}
          >
            {open ? "Show less" : "Read the full description"}
            <span aria-hidden="true">{open ? "↑" : "↓"}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
