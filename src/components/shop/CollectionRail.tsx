"use client";

/**
 * The row of category chips in the shop title band (redesigned 12 Nov 2026, replaces the live
 * site's round-image carousel). It is a plain horizontal scroller, so phones swipe it natively;
 * on desktop two arrow buttons move it by most of its width, and the edges fade out while there
 * is more to see on that side. The current category is marked and scrolled into view.
 *
 * Styles: ".shop-rail" and ".shop-card" in src/styles/shop.css.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { Icon } from "@/components/ui/Icon";
import type { CategoryTile } from "@/lib/catalog";

export type RailItem = CategoryTile & { count: number; current: boolean };

export function CollectionRail({ label, items }: { label: string; items: RailItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((old) => (old.start === start && old.end === end ? old : { start, end }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // A category far to the right (e.g. "VIP Stacks" among its siblings) starts in view, just after
    // the faded left edge (the scroller's scroll-padding, where chips snap).
    const current = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && current.offsetLeft + current.offsetWidth > el.clientWidth) {
      el.scrollLeft = current.offsetLeft - (parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0);
    }
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const move = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  const fade = [edges.start ? "start" : "", edges.end ? "end" : ""].join(" ").trim() || undefined;

  return (
    <div className="shop-rail" data-overflow={edges.start || edges.end ? "true" : undefined}>
      <div className="shop-rail__head">
        <h2 className="shop-rail__label">{label}</h2>
        <div className="shop-rail__arrows">
          <button type="button" className="shop-rail__arrow" disabled={!edges.start} aria-label="Scroll categories left" onClick={() => move(-1)}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="shop-rail__arrow" disabled={!edges.end} aria-label="Scroll categories right" onClick={() => move(1)}>
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div ref={scroller} className="shop-rail__scroller" data-fade={fade}>
        {items.map((item, index) => (
          <Link
            key={item.path}
            href={item.path}
            className="shop-card"
            aria-current={item.current ? "page" : undefined}
            style={{ "--i": Math.min(index, 8) } as CSSProperties}
          >
            <span className="shop-card__img">
              {/* eslint-disable-next-line @next/next/no-img-element -- the category thumbnails from the live site (100–300px files) */}
              <img src={item.image.src} srcSet={item.image.srcset} sizes="34px" width={item.image.width} height={item.image.height} alt="" decoding="async" />
            </span>
            <span className="shop-card__text">
              <span className="shop-card__name">{item.name}</span>
              {item.count > 0 ? (
                <span className="shop-card__count">
                  {item.count}
                  <span className="shop-card__sr"> {item.count === 1 ? "product" : "products"}</span>
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
