"use client";

/**
 * The bar under the product's top part that jumps to the page's sections (Overview, Benefits, Lab
 * results, Related products) and shows which one is being read. It sticks under the header while
 * the visitor scrolls (desktop and tablet).
 */
import { useEffect, useState } from "react";

export type SectionLink = { id: string; label: string };

export function ProductSectionNav({ links }: { links: SectionLink[] }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const sections = links.map((link) => document.getElementById(link.id)).filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;
    // The section whose top has passed the upper third of the screen is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [links]);

  if (links.length < 2) return null;
  return (
    <nav className="pp-nav" aria-label="On this page">
      <div className="pp-nav__inner">
        {links.map((link) => (
          <a key={link.id} href={`#${link.id}`} className="pp-nav__link" aria-current={current === link.id ? "location" : undefined}>
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
