"use client";

/**
 * Stores the browser's scrollbar width in the CSS variable --wd-scroll-w (Woodmart does the same),
 * used by Woodmart's "stretched" sections (.wd-section-stretch, src/styles/legacy-content.css).
 * Without a scrollbar that takes room (phones, overlay scrollbars) the theme's default .001px stays,
 * as on the live site (measured 5 Nov 2026: it makes those sections 1/64px narrower there, which
 * decides where the browser rounds the pictures below them).
 */
import { useEffect } from "react";

export function ScrollbarWidth() {
  useEffect(() => {
    // Desktop only: on phones a page that overflows sideways makes innerWidth larger than the
    // screen, and the live site keeps the default there (measured).
    const desktop = window.matchMedia("(min-width: 1025px)");
    const root = document.documentElement.style;
    const update = () => {
      const width = desktop.matches ? window.innerWidth - document.documentElement.clientWidth : 0;
      if (width > 0) root.setProperty("--wd-scroll-w", `${width}px`);
      else root.removeProperty("--wd-scroll-w");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return null;
}
