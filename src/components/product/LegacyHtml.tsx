"use client";

/**
 * Shows HTML copied from WordPress (descriptions, Elementor blocks) and brings back the little
 * JavaScript that content relied on: Woodmart's accordion widget (FAQ blocks), where clicking a
 * title (or pressing Enter on it) opens its answer and closes the others, as on the live site
 * (src/lib/elementor/accordion.ts).
 * The HTML must already be cleaned with cleanLegacyHtml (server side).
 */
import { useEffect, useRef } from "react";

import { toggleWoodmartAccordion, woodmartTitleAt } from "@/lib/elementor/accordion";

export function LegacyHtml({ html, className, as: Tag = "div" }: { html: string; className?: string; as?: "div" | "section" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const toggle = (target: EventTarget | null) => {
      const accordion = target instanceof Element ? target.closest(".wd-accordion") : null;
      const title = accordion && root.contains(accordion) ? woodmartTitleAt(accordion, target) : null;
      if (accordion && title) toggleWoodmartAccordion(accordion, title);
    };
    const onClick = (event: MouseEvent) => toggle(event.target);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") toggle(event.target);
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  // data-legacy-html: Tailwind utilities do not apply inside (see src/app/globals.css).
  return <Tag ref={ref} className={className} data-legacy-html="" dangerouslySetInnerHTML={{ __html: html }} />;
}
