"use client";

/**
 * An Elementor Pro popup of the live site, shown with its own document (children, rendered on the
 * server from src/content/popups/<id>.json) in Elementor's dialog frame, and opened and closed as
 * Elementor's popup script does there (settings from the live document):
 *
 *   * triggers: "scrolling" (the visitor scrolls down past the given % of the page) and "page_load"
 *     (after the given seconds); other popups open from a link "#elementor-action:action=popup:open…"
 *     (the 5% offer's "Claim My 5%" opens the sign-up form on top of it);
 *   * timing "times": shown at most N times per browser, counted where Elementor counts them
 *     (localStorage "elementor" → popup_<id>_times), so the counts carry over from the live site;
 *   * the × closes it, and so does a "#elementor-action:action=popup:close" link inside it ("Continue
 *     at full price"); Escape and a click outside don't when the settings say so (both popups here);
 *   * while one is open the page doesn't scroll ("prevent_scroll"); as with Elementor, closing any
 *     popup lets the page scroll again, even if another one is still open.
 * With `afterAgeGate` (the 5% offer, owner's decision of 6 Nov 2026, a change from the live site) the
 * popup waits for the age gate: it opens `delayMs` after "I'm 21+" is clicked, never while the age
 * gate is open, and uses its own triggers only when the age gate doesn't open on this visit
 * (src/lib/elementor/age-gate-state.ts).
 * The dialog is put at the end of <body> (a portal), where Elementor puts it.
 * Styles: Elementor's dialog + Pro popup CSS (src/styles/legacy/elementor-core.css), the popup's
 * own CSS (public/legacy/elementor/post-<id>.css) and src/styles/elementor-popup.css.
 */
import "@/styles/elementor-popup.css";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ageGateState, onAgeGateState, type AgeGateState } from "@/lib/elementor/age-gate-state";
import { countPopupShown, popupTimesShown } from "@/lib/elementor/popup-times";

export type PopupSettings = {
  prevent_close_on_background_click?: string;
  prevent_close_on_esc_key?: string;
  prevent_scroll?: string;
  triggers?: { scrolling?: string; scrolling_direction?: string; scrolling_offset?: number; page_load?: string; page_load_delay?: number } | unknown[];
  timing?: { times?: string; times_times?: number } | unknown[];
};

const OPEN_EVENT = "elementor-popup-open";
const CLOSE_EVENT = "elementor-popup-close";

/** "#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3D<base64 JSON>" → { action, settings }. */
function readAction(href: string): { action: string; settings: Record<string, unknown> } | null {
  const text = decodeURIComponent(href.replace(/^#/, ""));
  const match = /^elementor-action:action=([^&]+)(?:&settings=(.*))?$/.exec(text);
  if (!match) return null;
  let settings: Record<string, unknown> = {};
  try {
    settings = match[2] ? JSON.parse(atob(match[2])) : {};
  } catch {
    settings = {};
  }
  return { action: match[1], settings };
}

/** One click listener for the whole page handles the Elementor action links (installed once). */
let actionsListening = false;
function listenForActions() {
  if (actionsListening) return;
  actionsListening = true;
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#elementor-action"]') : null;
    if (!link) return;
    const action = readAction(link.getAttribute("href") ?? "");
    if (!action) return;
    event.preventDefault();
    if (action.action === "popup:open" && action.settings.id) {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: Number(action.settings.id) }));
    } else if (action.action === "popup:close") {
      const modal = link.closest<HTMLElement>(".elementor-popup-modal");
      const id = modal ? Number(modal.id.replace("elementor-popup-modal-", "")) : null;
      window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: id }));
    }
  });
}

export function ElementorPopup({
  id,
  settings,
  afterAgeGate,
  children,
}: {
  id: number;
  settings: PopupSettings;
  /** Wait for the age gate, then open this many ms after "I'm 21+" (see above). */
  afterAgeGate?: { delayMs: number };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  const triggers = Array.isArray(settings.triggers) ? {} : (settings.triggers ?? {});
  const timing = Array.isArray(settings.timing) ? {} : (settings.timing ?? {});
  const maxTimes = timing.times === "yes" ? Number(timing.times_times ?? 1) : Infinity;
  const ageGateDelay = afterAgeGate?.delayMs;

  useEffect(() => {
    listenForActions();
    const show = () => {
      setOpen(true);
      countPopupShown(id);
    };
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<number>).detail === id) show();
    };
    const onClose = (event: Event) => {
      const target = (event as CustomEvent<number | null>).detail;
      if (target === null || target === id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    const cleanups = [() => window.removeEventListener(OPEN_EVENT, onOpen), () => window.removeEventListener(CLOSE_EVENT, onClose)];

    /** The live triggers; returns the function that stops them. */
    const startTriggers = () => {
      const stops: Array<() => void> = [];
      if (triggers.page_load === "yes") {
        const timer = window.setTimeout(show, Number(triggers.page_load_delay ?? 0) * 1000);
        stops.push(() => window.clearTimeout(timer));
      }
      if (triggers.scrolling === "yes") {
        // Elementor: fires once, when the visitor scrolls (down) past the offset (% of the page).
        let last = window.scrollY;
        const onScroll = () => {
          const y = window.scrollY;
          const down = y > last;
          last = y;
          if (triggers.scrolling_direction === "down" && !down) return;
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          if (scrollable > 0 && (y / scrollable) * 100 >= Number(triggers.scrolling_offset ?? 0)) {
            window.removeEventListener("scroll", onScroll);
            show();
          }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        stops.push(() => window.removeEventListener("scroll", onScroll));
      }
      return () => stops.forEach((stop) => stop());
    };

    if (popupTimesShown(id) < maxTimes) {
      if (ageGateDelay === undefined) {
        cleanups.push(startTriggers());
      } else {
        // Wait for the age gate: nothing while it is waiting or open, the delay after "I'm 21+",
        // the live triggers when it doesn't open on this visit.
        let stop: (() => void) | undefined;
        const follow = (state: AgeGateState) => {
          stop?.();
          stop = undefined;
          if (state === "confirmed") {
            const timer = window.setTimeout(show, ageGateDelay);
            stop = () => window.clearTimeout(timer);
          } else if (state === "not-shown") {
            stop = startTriggers();
          }
        };
        follow(ageGateState());
        const unsubscribe = onAgeGateState(follow);
        cleanups.push(() => {
          unsubscribe();
          stop?.();
        });
      }
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [id, maxTimes, ageGateDelay, triggers.page_load, triggers.page_load_delay, triggers.scrolling, triggers.scrolling_direction, triggers.scrolling_offset]);

  // Page scrolling: locked while open; closing any popup unlocks it (Elementor's behaviour).
  useEffect(() => {
    if (!open) return;
    if (settings.prevent_scroll === "yes") document.body.classList.add("dialog-prevent-scroll");
    modal.current?.focus();
    return () => document.body.classList.remove("dialog-prevent-scroll");
  }, [open, settings.prevent_scroll]);

  useEffect(() => {
    if (!open || settings.prevent_close_on_esc_key === "yes") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, settings.prevent_close_on_esc_key]);

  if (!open) return null;
  return createPortal(
    // Elementor's own markup (role="document" with aria-modal), kept as on the live site.
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <div
      ref={modal}
      className="dialog-widget dialog-lightbox-widget dialog-type-buttons dialog-type-lightbox elementor-popup-modal elementor-page elementor-kit-7"
      id={`elementor-popup-modal-${id}`}
      aria-modal="true"
      role="document"
      tabIndex={0}
      data-legacy-html=""
      onClick={(event) => {
        if (event.target === event.currentTarget && settings.prevent_close_on_background_click !== "yes") setOpen(false);
      }}
    >
      <div className="dialog-widget-content dialog-lightbox-widget-content animated">
        <a
          role="button"
          tabIndex={0}
          aria-label="Close"
          href="#"
          className="dialog-close-button dialog-lightbox-close-button"
          onClick={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <svg className="e-font-icon-svg e-eicon-close eicon-close" viewBox="0 0 1000 1000" aria-hidden="true">
            <path d="M742 167L500 408 258 167C246 154 233 150 217 150 196 150 179 158 167 167 154 179 150 196 150 212 150 229 154 242 171 254L408 500 167 742C138 771 138 800 167 829 196 858 225 858 254 829L496 587 738 829C750 842 767 846 783 846 800 846 817 842 829 829 842 817 846 804 846 783 846 767 842 750 829 737L588 500 833 258C863 229 863 200 833 171 804 137 775 137 742 167Z" />
          </svg>
        </a>
        <div className="dialog-header dialog-lightbox-header" />
        <div className="dialog-message dialog-lightbox-message">{children}</div>
        <div className="dialog-buttons-wrapper dialog-lightbox-buttons-wrapper" />
      </div>
    </div>,
    document.body,
  );
}
