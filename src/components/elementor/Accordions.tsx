"use client";

/**
 * The two accordion widgets of the Elementor pages, with the markup WordPress printed (shown by
 * ElementorContent) and the behaviour of the live site's scripts (src/lib/elementor/accordion.ts):
 *
 *   * WoodmartAccordion: Woodmart's FAQ block (.wd-accordion). A title opens on click and, as the
 *     theme's script does for its ".wd-role-btn" elements, on Enter.
 *   * ContentAccordion: Unlimited Elements' "Content Accordion" (.uc_material_accordion, /hgh-bali/).
 *     Its titles are links, so Enter already clicks them.
 *   * ElementorToggle: Elementor's "Toggle" (.elementor-toggle, /affiliate-program/). As Elementor's
 *     handler does: a click, or Enter / Space released on a title, opens or closes it; Home / End
 *     move to the first / last title.
 *
 * The answers keep their own HTML; these components only listen for clicks on the titles.
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

import {
  contentAccordionTriggerAt,
  toggleContentAccordion,
  toggleElementorToggle,
  toggleTitleAt,
  toggleWoodmartAccordion,
  woodmartTitleAt,
} from "@/lib/elementor/accordion";

type Props = { attributes: HTMLAttributes<HTMLDivElement>; children: ReactNode };

export function WoodmartAccordion({ attributes, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const accordion = ref.current;
    if (!accordion) return;
    const onClick = (event: MouseEvent) => {
      const title = woodmartTitleAt(accordion, event.target);
      if (title) toggleWoodmartAccordion(accordion, title);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const title = event.key === "Enter" ? woodmartTitleAt(accordion, event.target) : null;
      if (title) toggleWoodmartAccordion(accordion, title);
    };
    accordion.addEventListener("click", onClick);
    accordion.addEventListener("keydown", onKeyDown);
    return () => {
      accordion.removeEventListener("click", onClick);
      accordion.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return (
    <div {...attributes} ref={ref}>
      {children}
    </div>
  );
}

export function ElementorToggle({ attributes, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toggle = ref.current;
    if (!toggle) return;
    const onClick = (event: MouseEvent) => {
      const title = toggleTitleAt(toggle, event.target);
      if (!title) return;
      event.preventDefault();
      toggleElementorToggle(toggle, title);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const title = toggleTitleAt(toggle, event.target);
      if (!title) return;
      if (event.key === "Enter" && event.target instanceof HTMLAnchorElement) event.preventDefault();
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const titles = toggle.querySelectorAll<HTMLElement>(":scope > .elementor-toggle-item > .elementor-tab-title");
        titles[event.key === "Home" ? 0 : titles.length - 1]?.focus();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const title = toggleTitleAt(toggle, event.target);
      if (!title || (event.code !== "Enter" && event.code !== "Space")) return;
      event.preventDefault();
      toggleElementorToggle(toggle, title);
    };
    toggle.addEventListener("click", onClick);
    toggle.addEventListener("keydown", onKeyDown);
    toggle.addEventListener("keyup", onKeyUp);
    return () => {
      toggle.removeEventListener("click", onClick);
      toggle.removeEventListener("keydown", onKeyDown);
      toggle.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  return (
    <div {...attributes} ref={ref}>
      {children}
    </div>
  );
}

export function ContentAccordion({ attributes, closeOthers, duration, children }: Props & { closeOthers: boolean; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const accordion = ref.current;
    if (!accordion) return;
    const onClick = (event: MouseEvent) => {
      const trigger = contentAccordionTriggerAt(accordion, event.target);
      if (!trigger) return;
      event.preventDefault(); // the title is a link to "#"
      toggleContentAccordion(trigger, { closeOthers, duration });
    };
    accordion.addEventListener("click", onClick);
    return () => accordion.removeEventListener("click", onClick);
  }, [closeOthers, duration]);
  return (
    <div {...attributes} ref={ref}>
      {children}
    </div>
  );
}
