"use client";

/**
 * The note the live site shows while someone searches for a compound by its name: "GLP-3 RTA: Known
 * as retatrutide, it is a triple agonist … →" (the owner's inline script; data and matching rules:
 * src/lib/search/aliases.ts). As there:
 *   * it shows as soon as enough letters are typed ("reta"), before the suggestions arrive, one line
 *     per compound the text refers to; each line links to the code name's product search;
 *   * × fades it out (200 ms) and keeps it closed while the text still refers to those compounds;
 *     typing something else and then the name again brings it back;
 *   * pressing on it doesn't take the cursor out of the search box.
 * Where it shows: above the suggestions of the header search and of the mobile menu's search, and on
 * the search results pages (above the products; on the site search inside the post grid, as live).
 * Styles: src/styles/search-alias.css (the owner's CSS).
 */
import "@/styles/search-alias.css";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { aliasSearchPath, COMPOUND_ALIASES, matchCompoundAliases, type CompoundName } from "@/lib/search/aliases";

export function AliasNotice({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const matched = matchCompoundAliases(query);
  const [shut, setShut] = useState<CompoundName[]>([]);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A dismissed compound comes back once the text no longer refers to it (the live script's
  // visible()): forgotten during render, React's way of adjusting state to new props.
  const stillShut = shut.filter((name) => matched.includes(name));
  if (stillShut.length !== shut.length) setShut(stillShut);
  useEffect(() => () => clearTimeout(timer.current), []);

  const shown = matched.filter((name) => !stillShut.includes(name));
  if (shown.length === 0) return null;
  return (
    <div className={`glp-search-notice${closing ? " glp-closing" : ""}`} data-olds={shown.join(",")} onMouseDown={(event) => event.preventDefault()}>
      {shown.map((name) => (
        <p key={name}>
          <Link className="glp-search-notice-link" href={aliasSearchPath(name)} onClick={onNavigate}>
            <strong>{COMPOUND_ALIASES[name].code}</strong>: {COMPOUND_ALIASES[name].note} <span aria-hidden="true">→</span>
          </Link>
        </p>
      ))}
      <button
        type="button"
        className="glp-search-notice-close"
        aria-label="Dismiss note"
        onClick={() => {
          setClosing(true);
          timer.current = setTimeout(() => {
            setShut((current) => [...current, ...shown]);
            setClosing(false);
          }, 200);
        }}
      >
        ×
      </button>
    </div>
  );
}
