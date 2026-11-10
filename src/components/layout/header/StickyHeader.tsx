"use client";

/**
 * Makes the white header pill stick to the top after the visitor scrolls past the header
 * (Woodmart "sticky header" setting on the live site). The CSS for the sticky look is
 * `.site-header[data-sticky="true"]` in src/styles/site-chrome.css.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export function StickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const headerHeight = ref.current?.offsetHeight ?? 112;
      setSticky(window.scrollY > headerHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header ref={ref} className="site-header" data-sticky={sticky}>
      {children}
    </header>
  );
}
