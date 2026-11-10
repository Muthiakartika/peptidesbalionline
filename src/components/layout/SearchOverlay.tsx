"use client";

/**
 * Full-screen product search that slides in under the header (Woodmart "full screen" search).
 * From 3 typed characters it shows suggestions (categories and products) after a 300ms pause,
 * like the live site (useSearchSuggestions.ts). Enter opens the search results page
 * (/?s=…&post_type=product). Typing a compound's name ("reta") also shows the owner's note with its
 * code name (AliasNotice.tsx), at once, between the loader and the suggestions as on live.
 */
import { useEffect, useRef, useState } from "react";
import { useChrome } from "./ChromeProvider";
import { AliasNotice } from "./search/AliasNotice";
import { SearchSuggestions } from "./search/SearchSuggestions";
import { useSearchSuggestions } from "./search/useSearchSuggestions";
import { Icon } from "@/components/ui/Icon";

export function SearchOverlay() {
  const { openPanel, close } = useChrome();
  const isOpen = openPanel === "search";
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { result, loading, search } = useSearchSuggestions();
  // What is typed, for the compound-name note (it shows at once, before the suggestions).
  const [typed, setTyped] = useState("");
  // A new page forgets the dismissed notes, as a page load does on the live site.
  const [visits, setVisits] = useState(0);
  const navigate = () => {
    setVisits((n) => n + 1);
    close();
  };

  useEffect(() => {
    if (!isOpen || !overlayRef.current) return;
    // Start right below the header, wherever it currently is (normal or sticky).
    const header = document.querySelector(".site-header .header-pill");
    overlayRef.current.style.top = `${Math.round(header?.getBoundingClientRect().bottom ?? 112)}px`;
    inputRef.current?.focus();
  }, [isOpen]);

  return (
    <div
      ref={overlayRef}
      className="search-overlay"
      style={{ top: 112 }}
      data-open={isOpen}
      data-searched={result !== null || undefined}
      role="complementary"
      aria-label="Search"
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <button type="button" className="search-overlay__close" aria-label="Close search form" onClick={close}>
        <Icon name="close" />
      </button>
      <form role="search" method="get" action="/" className="search-overlay__form" data-loading={loading || undefined} autoComplete="off">
        <input
          ref={inputRef}
          type="text"
          name="s"
          required
          placeholder="Search for products"
          aria-label="Search"
          title="Search for products"
          className="search-overlay__input"
          onChange={(event) => {
            setTyped(event.target.value);
            search(event.target.value);
          }}
        />
        <input type="hidden" name="post_type" value="product" />
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>
      <div className="search-overlay__loader" data-loading={loading || undefined} aria-hidden="true" />
      {/* Between the loader and the suggestions, where the owner's script puts it on the live site. */}
      <AliasNotice key={visits} query={typed} onNavigate={navigate} />
      {result === null ? <div className="search-overlay__info">Start typing to see products you are looking for.</div> : null}
      <div className="search-overlay__results">{result ? <SearchSuggestions result={result} onNavigate={navigate} /> : null}</div>
    </div>
  );
}
