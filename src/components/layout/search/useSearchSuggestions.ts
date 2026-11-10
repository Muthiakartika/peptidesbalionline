"use client";

/**
 * The product suggestions of a search box, as Woodmart's AJAX search loads them on the live site
 * (data-symbols_count="3", ajax_search_delay 300): from 3 typed characters, 300 ms after the last
 * key, from /api/search-suggestions/. Answers are kept, so typing a text again shows them at once.
 * Used by the header search (SearchOverlay.tsx) and the mobile menu's search (MobileNav.tsx).
 */
import { useEffect, useRef, useState } from "react";

import type { SuggestionResponse } from "./suggestion-types";

const MIN_CHARACTERS = 3;
const DELAY_MS = 300;

export function useSearchSuggestions() {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, SuggestionResponse>());
  const [result, setResult] = useState<SuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(value: string) {
    clearTimeout(timer.current);
    request.current?.abort();
    const query = value.trim();
    if (query.length < MIN_CHARACTERS) {
      setLoading(false);
      setResult(null);
      return;
    }
    const cached = cache.current.get(query);
    if (cached) {
      setLoading(false);
      setResult(cached);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch(`/api/search-suggestions/?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await response.json()) as SuggestionResponse;
        cache.current.set(query, data);
        setResult(data);
        setLoading(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLoading(false);
      }
    }, DELAY_MS);
  }

  return { result, loading, search };
}
