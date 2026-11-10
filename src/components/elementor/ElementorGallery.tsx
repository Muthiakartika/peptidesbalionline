"use client";

/**
 * The Elementor Pro "Gallery" widget, grid layout (the photos next to "Trusted Peptide Delivery Across
 * Bali"). The items are the widget's own HTML; this component does what Elementor's gallery script
 * (E-Gallery) does there:
 *
 *   * the grid: columns, gaps and picture shape from the widget's settings, per screen size
 *     (Elementor's breakpoints: phones up to 767px, tablets up to 1024px). They're written as CSS
 *     first, so the grid is right before any JavaScript runs; then set on the element as the script
 *     does (--columns, --rows, --hgap, --vgap, --aspect-ratio, … and --column / --row per item);
 *   * lazy loading: a picture is downloaded when it comes into view; once it has loaded it becomes the
 *     item's background and gets the class "e-gallery-image-loaded", and the widget's CSS fades and
 *     scales it in.
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { galleryAspectPercent, galleryContainerRatio, galleryLayouts, type GalleryLayout, type GallerySettings } from "@/lib/elementor/widgets";

export function ElementorGallery({ widgetId, className, settings, children }: { widgetId: string; className: string; settings: GallerySettings; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { desktop, tablet, mobile } = useMemo(() => galleryLayouts(settings), [settings]);
  const aspect = galleryAspectPercent(settings.aspect_ratio);
  const lazy = settings.lazyload === "yes";

  // The grid for each screen size, as CSS (until the script below sets the same values inline).
  const selector = `.elementor-element-${widgetId} .e-gallery-container`;
  const rule = (layout: GalleryLayout) => `--columns:${layout.columns};--hgap:${layout.gap}px;--vgap:${layout.gap}px;--aspect-ratio:${aspect}%;--animation-duration:350ms`;
  const css = `${selector}{${rule(desktop)}}@media (max-width:1024px){${selector}{${rule(tablet)}}}@media (max-width:767px){${selector}{${rule(mobile)}}}`;

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const items = [...container.querySelectorAll<HTMLElement>(":scope > .e-gallery-item")];
    const tabletQuery = window.matchMedia("(max-width: 1024px)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const apply = () => {
      const layout = mobileQuery.matches ? mobile : tabletQuery.matches ? tablet : desktop;
      const rows = Math.ceil(items.length / layout.columns);
      const containerRatio = galleryContainerRatio(container.clientWidth || 1, items.length, layout, aspect);
      container.setAttribute(
        "style",
        `--hgap: ${layout.gap}px; --vgap: ${layout.gap}px; --animation-duration: 350ms; --columns: ${layout.columns}; --rows: ${rows}; --aspect-ratio: ${aspect}%; --container-aspect-ratio: ${containerRatio}%;`,
      );
      items.forEach((item, i) => item.setAttribute("style", `--column: ${i % layout.columns}; --row: ${Math.floor(i / layout.columns)};`));
    };
    apply();
    tabletQuery.addEventListener("change", apply);
    mobileQuery.addEventListener("change", apply);
    window.addEventListener("resize", apply);

    // Lazy loading: download each picture when it comes into view.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const image = entry.target as HTMLElement;
        observer.unobserve(image);
        const src = image.dataset.thumbnail;
        if (!src) continue;
        const loader = new Image();
        loader.onload = () => {
          image.style.backgroundImage = `url("${src}")`;
          image.classList.add("e-gallery-image-loaded");
        };
        loader.src = src;
      }
    });
    container.querySelectorAll<HTMLElement>(".e-gallery-image").forEach((image) => {
      if (lazy) observer.observe(image);
      else if (image.dataset.thumbnail) image.style.backgroundImage = `url("${image.dataset.thumbnail}")`;
    });

    return () => {
      tabletQuery.removeEventListener("change", apply);
      mobileQuery.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
      observer.disconnect();
    };
  }, [desktop, tablet, mobile, aspect, lazy]);

  return (
    <>
      <style>{css}</style>
      <div ref={root} className={`${className} e-gallery-container e-gallery-grid e-gallery--ltr${lazy ? " e-gallery--lazyload" : ""}`}>
        {children}
      </div>
    </>
  );
}
