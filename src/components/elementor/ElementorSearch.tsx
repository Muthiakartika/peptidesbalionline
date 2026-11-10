"use client";

/**
 * The Elementor Pro "Search" widget (two on the homepage). The form is the widget's own HTML and
 * submits as on the live site (GET /?s=…); this component does what Elementor's script does there
 * (measured on the live homepage, 4 Nov 2026):
 *
 *   * the search field leaves room for the magnifier icon: Elementor's CSS reads its width from
 *     --e-search-icon-label-absolute-width, which the script measures (16px here; the server HTML
 *     starts with the icon's size so nothing moves when this runs). There's no "clear" icon (0px);
 *   * while the field has focus the widget has the class "e-focus" (the widget's CSS styles it);
 *   * a click elsewhere closes the results box (class "hidden" on it).
 *
 * The live site has "live results" switched on, but it shows none (typing sends no request), so
 * the results box stays empty here too.
 */
import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export function ElementorSearch({ attributes, children }: { attributes: HTMLAttributes<HTMLDivElement>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const widget = ref.current;
    if (!widget) return;
    const icon = widget.querySelector(".e-search-label > svg, .e-search-label > i");
    const clear = widget.querySelector(".e-search-input-clear");
    widget.style.setProperty("--e-search-icon-label-absolute-width", `${icon ? icon.getBoundingClientRect().width : 0}px`);
    widget.style.setProperty("--e-search-icon-clear-absolute-width", `${clear ? clear.getBoundingClientRect().width : 0}px`);

    const results = widget.querySelector(".e-search-results-container");
    const onFocusIn = () => {
      widget.classList.add("e-focus");
      results?.classList.remove("hidden");
    };
    const onPointerDown = (event: PointerEvent) => {
      if (widget.contains(event.target as Node)) return;
      widget.classList.remove("e-focus");
      results?.classList.add("hidden");
    };
    widget.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      widget.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const style = {
    ...(attributes.style as CSSProperties | undefined),
    "--e-search-icon-label-absolute-width": "var(--e-search-icon-label-size)",
    "--e-search-icon-clear-absolute-width": "0px",
  } as CSSProperties;
  return (
    <div ref={ref} {...attributes} style={style}>
      {children}
    </div>
  );
}
