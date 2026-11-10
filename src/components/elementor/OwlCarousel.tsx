"use client";

/**
 * The Unlimited Elements "Content Carousel" (Owl Carousel 2 on the live site), e.g. the lab
 * certificates on the homepage. Same markup as Owl after it starts (owl-stage-outer > owl-stage >
 * owl-item, with cloned items at both ends for the endless loop), so the widget's own CSS applies.
 *
 *   * items per view and gap from the live options (responsive, e.g. 2 / 3 / 4 at 0 / 768 / 980px);
 *   * the arrows of the section (RemoteArrows) move it one item at a time, with Owl's 1s slide;
 *   * it can be dragged with the mouse or a finger;
 *   * it loops: after sliding into a copy at either end it jumps back to the real item, unseen;
 *   * autoplay, when switched on (as measured on the live site, 5 Nov 2026): one item every 5s; paused
 *     while the pointer is over the carousel (or a finger on it), then continued for the time that was
 *     left; a click on the arrows starts the 5s again.
 * The layout is CSS only (widths in % of the carousel), so it is right before any JavaScript runs.
 */
import { Children, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TransitionEvent } from "react";

import { owlCloneCount } from "@/lib/elementor/widgets";

type Breakpoint = { items?: number; margin?: number };
export type OwlOptions = {
  loop?: boolean;
  margin?: number;
  smartSpeed?: number;
  mouseDrag?: boolean;
  touchDrag?: boolean;
  autoplay?: boolean;
  autoplayTimeout?: number;
  autoplayHoverPause?: boolean;
  responsive?: Record<string, Breakpoint>;
};

export function OwlCarousel({ id, className, options, children }: { id: string; className: string; options: OwlOptions; children: ReactNode }) {
  const items = Children.toArray(children).filter((child) => typeof child !== "string" || child.trim());
  const total = items.length;
  const breakpoints = useMemo(
    () =>
      Object.entries(options.responsive ?? {})
        .map(([min, value]) => ({ min: Number(min), items: value.items ?? 1, margin: value.margin ?? options.margin ?? 0 }))
        .sort((a, b) => a.min - b.min),
    [options],
  );
  const maxItems = Math.max(1, ...breakpoints.map((b) => b.items));
  const clones = owlCloneCount(total, maxItems, options.loop ?? false);
  // Owl's order: [last `clones` items] + items + [first `clones` items].
  const stage = [...items.slice(total - clones).map((item, i) => ({ item, cloned: true, key: `b${i}` })), ...items.map((item, i) => ({ item, cloned: false, key: `r${i}` })), ...items.slice(0, clones).map((item, i) => ({ item, cloned: true, key: `a${i}` }))];
  const count = stage.length;

  const root = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(clones); // index of the first visible item in `stage`
  const [animate, setAnimate] = useState(false);
  const [drag, setDrag] = useState(0); // px while dragging
  const [dragging, setDragging] = useState(false);
  const [perView, setPerView] = useState(breakpoints[0]?.items ?? 1);
  const dragStart = useRef<{ x: number; moved: boolean } | null>(null);

  // Which breakpoint applies (Owl compares the window width with the "responsive" keys).
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const active = breakpoints.filter((b) => b.min <= width).pop();
      setPerView(active?.items ?? 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpoints]);

  const step = useCallback(
    (by: number) => {
      setAnimate(true);
      setPosition((p) => Math.max(0, Math.min(count - perView, p + by)));
    },
    [count, perView],
  );

  // Autoplay (Owl's autoplay plugin, measured on the live site).
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    const element = root.current;
    if (!element || !options.autoplay) return;
    const timeout = options.autoplayTimeout ?? 5000;
    let timer = 0;
    let due = 0;
    let left = timeout;
    let paused = false;
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      due = performance.now() + ms;
      timer = window.setTimeout(() => {
        stepRef.current(1);
        schedule(timeout);
      }, ms);
    };
    const pause = () => {
      if (paused) return;
      paused = true;
      left = Math.max(0, due - performance.now());
      window.clearTimeout(timer);
    };
    const resume = () => {
      if (!paused) return;
      paused = false;
      schedule(left);
    };
    // The remote arrows start the count again.
    const restart = () => (paused ? (left = timeout) : schedule(timeout));
    schedule(timeout);
    const hover = options.autoplayHoverPause === true;
    if (hover) {
      element.addEventListener("mouseenter", pause);
      element.addEventListener("mouseleave", resume);
      element.addEventListener("touchstart", pause, { passive: true });
      element.addEventListener("touchend", resume);
    }
    element.addEventListener("owl:step", restart);
    return () => {
      window.clearTimeout(timer);
      if (hover) {
        element.removeEventListener("mouseenter", pause);
        element.removeEventListener("mouseleave", resume);
        element.removeEventListener("touchstart", pause);
        element.removeEventListener("touchend", resume);
      }
      element.removeEventListener("owl:step", restart);
    };
  }, [options]);

  // Arrows elsewhere in the section send "owl:step" events to this carousel.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const onStep = (event: Event) => step((event as CustomEvent<number>).detail);
    element.addEventListener("owl:step", onStep);
    return () => element.removeEventListener("owl:step", onStep);
  }, [step]);

  // After sliding into the copies, jump (without animation) to the same picture among the real items.
  // (Only the stage's own slide counts: transitions inside the cards, e.g. on hover, bubble up too.)
  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !clones) return;
    setAnimate(false);
    setPosition((p) => (p < clones ? p + total : p >= clones + total ? p - total : p));
  };

  const style = {
    "--owl-count": count,
    "--owl-position": position,
    "--owl-drag": `${drag}px`,
    transition: animate && !dragging ? `all ${(options.smartSpeed ?? 250) / 1000}s ease 0s` : "all 0s ease 0s",
  } as CSSProperties;

  const canDrag = options.mouseDrag !== false || options.touchDrag !== false;

  return (
    <div
      ref={root}
      id={id}
      className={`${className} owl-loaded${canDrag ? " owl-drag" : ""}`}
      data-owl-items={perView}
    >
      {/* Items per view and gap for each window width (Owl's "responsive" option), as CSS. */}
      <style>
        {breakpoints
          .map((b) => {
            const rule = `#${id}{--owl-items:${b.items};--owl-gap:${b.margin}px}`;
            return b.min > 0 ? `@media (min-width:${b.min}px){${rule}}` : rule;
          })
          .join("")}
      </style>
      <div
        className="owl-stage-outer"
        onPointerDown={(event) => {
          if (!canDrag) return;
          dragStart.current = { x: event.clientX, moved: false };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const d = dragStart.current;
          if (!d) return;
          const dx = event.clientX - d.x;
          if (Math.abs(dx) > 3) d.moved = true;
          setDrag(dx);
        }}
        onPointerUp={(event) => {
          const d = dragStart.current;
          dragStart.current = null;
          setDragging(false);
          setDrag(0);
          if (!d) return;
          const dx = event.clientX - d.x;
          if (Math.abs(dx) > 30) step(dx < 0 ? 1 : -1);
          else setAnimate(true);
        }}
        onClickCapture={(event) => {
          // A drag is not a click on the link under the pointer.
          if (dragStart.current?.moved) event.preventDefault();
        }}
      >
        <div className="owl-stage" style={style} onTransitionEnd={onTransitionEnd}>
          {stage.map(({ item, cloned, key }, i) => (
            <div
              key={key}
              // "uc-active-item": the first item in view (Unlimited Elements marks it for the widget's CSS).
              className={`owl-item${cloned ? " cloned" : ""}${i === position ? " uc-active-item" : ""}${i >= position && i < position + perView ? " active" : ""}`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="owl-nav disabled">
        <button type="button" role="presentation" className="owl-prev">
          <span aria-label="Previous">‹</span>
        </button>
        <button type="button" role="presentation" className="owl-next">
          <span aria-label="Next">›</span>
        </button>
      </div>
      <div className="owl-dots disabled" />
    </div>
  );
}
