"use client";

/**
 * The Google reviews slider (Trustindex plugin, layout "slider"). The reviews themselves are the HTML
 * the plugin printed on the live site; this component adds what the plugin's script does there
 * (measured on the live homepage, 4 Nov 2026):
 *
 *   * columns: as many reviews side by side as fit at 300px each (3 on desktop, 2 on tablets, 1 on
 *     phones), set as the class ti-col-<n> that the plugin's CSS sizes;
 *   * arrows (desktop): one review per click with a 0.5s slide (clicks during a slide are ignored);
 *     "previous" is hidden at the start, "next" at the end;
 *   * autoplay: one review every 6s with a 1s slide, back and forth between both ends; paused while
 *     the pointer is over the reviews, stopped for good once the visitor uses the arrows or swipes;
 *   * long reviews are cut after 4 lines (plugin CSS) with "Read more", which opens the full text
 *     ("Hide" closes it);
 *   * phones: a progress bar under the reviews (plugin CSS shows it below 480px).
 *
 * The HTML stays the plugin's, so its stylesheet (public/legacy/vendor/trustindex-google-widget.css)
 * styles it unchanged. The reviews slide as the plugin moves them: every review's "left" is animated
 * (Web Animations), by one review's width per step.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SWING } from "@/lib/elementor/slide"; // jQuery's "swing" easing, which the plugin's slide uses
import { trustindexColumns, trustindexDotLeft } from "@/lib/elementor/widgets";

type Slide = { index: number; duration: number }; // first review in view; length of the slide there (0 = jump)

export function TrustindexReviews({ className, reviewWidth, autoplaySeconds, children }: { className: string; reviewWidth: number; autoplaySeconds: number; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<number | null>(null); // null until measured: keeps the printed class
  const [width, setWidth] = useState(0); // of the widget: the reviews' offset is in pixels
  const placedAt = useRef(0); // the width the reviews were last placed for
  const [slide, setSlide] = useState<Slide>({ index: 0, duration: 0 });
  const current = useRef(0);
  const sliding = useRef(false);
  const autoplay = useRef({ stopped: false, paused: false, direction: 1 });

  const parts = () => {
    const el = root.current!;
    return {
      track: el.querySelector<HTMLElement>(".ti-reviews-container-wrapper"),
      items: [...el.querySelectorAll<HTMLElement>(".ti-review-item")],
      prev: el.querySelector<HTMLElement>(".ti-prev"),
      next: el.querySelector<HTMLElement>(".ti-next"),
      controls: el.querySelector<HTMLElement>(".ti-controls"),
      line: el.querySelector<HTMLElement>(".ti-controls-line"),
      dot: el.querySelector<HTMLElement>(".ti-controls-line .dot"),
    };
  };
  const lastIndex = (cols: number) => Math.max(0, parts().items.length - cols);

  // Columns from the widget's width (and again when it changes).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      setColumns(trustindexColumns(el.clientWidth, reviewWidth));
      setWidth(el.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [reviewWidth]);

  // "Read more" on every review whose text is longer than the 4 lines shown (measured again when the
  // number of columns changes the width of the text).
  useEffect(() => {
    if (columns === null) return;
    const cleanups: (() => void)[] = [];
    for (const item of parts().items) {
      item.style.position = "relative"; // as the plugin's script does
      const content = item.querySelector<HTMLElement>(".ti-review-content");
      const more = item.querySelector<HTMLElement>(".ti-read-more");
      if (!content || !more) continue;
      content.style.cssText = "";
      more.style.cssText = "";
      const initial = content.clientHeight;
      const full = content.scrollHeight;
      content.style.setProperty("height", `${initial}px`, "important");
      content.dataset.initialHeight = String(initial);
      const label = document.createElement("span");
      more.replaceChildren(label);
      if (full <= initial) {
        label.innerHTML = "&nbsp;";
        more.style.opacity = "0";
        more.style.pointerEvents = "none";
        more.removeAttribute("role");
        continue;
      }
      content.dataset.expandedHeight = String(full);
      label.className = "ti-read-more-active";
      label.textContent = more.dataset.openText ?? "Read more";
      more.setAttribute("role", "button");
      more.tabIndex = -1;
      let open = false;
      const toggle = () => {
        open = !open;
        content.style.cssText = open ? `height: ${full}px !important; display: block !important; -webkit-line-clamp: unset !important;` : `height: ${initial}px !important;`;
        label.textContent = (open ? more.dataset.collapseText : more.dataset.openText) ?? "";
      };
      more.addEventListener("click", toggle);
      cleanups.push(() => more.removeEventListener("click", toggle));
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [columns]);

  // Show the review at slide.index: slide the row there, update the arrows and the progress bar.
  useEffect(() => {
    if (columns === null) return;
    const { track, items, prev, next, controls, line, dot } = parts();
    if (!track || !items.length) return;
    const last = lastIndex(columns);
    const index = Math.min(slide.index, last);
    current.current = index;
    if (prev) prev.style.display = index > 0 ? "" : "none";
    if (next) next.style.display = index < last ? "" : "none";
    if (controls) controls.style.top = `${(items[0].offsetHeight + parseFloat(getComputedStyle(track).paddingTop)) / 2}px`;
    if (dot && line) {
      const positions = last + 1;
      dot.style.width = `${Math.max(1, line.clientWidth / positions)}px`;
      dot.style.left = `${trustindexDotLeft(index, positions)}%`;
    }
    // From where the reviews are now (also halfway through a slide) to the new position.
    const from = parseFloat(getComputedStyle(items[0]).left) || 0;
    const to = -index * items[0].offsetWidth;
    // After a resize the reviews jump to their new place; only a new slide is animated.
    const duration = placedAt.current === width ? slide.duration : 0;
    placedAt.current = width;
    if (from === to) return;
    const animations = items.map((item) => {
      item.getAnimations().forEach((animation) => animation.cancel());
      return item.animate([{ left: `${from}px` }, { left: `${to}px` }], { duration, easing: SWING, fill: "forwards" });
    });
    sliding.current = duration > 0;
    animations[0].onfinish = () => (sliding.current = false);
    return () => {
      sliding.current = false;
    };
  }, [slide, columns, width]); // eslint-disable-line react-hooks/exhaustive-deps -- parts() reads the DOM

  // Arrows, swipes, hover pause and the autoplay timer.
  useEffect(() => {
    const el = root.current;
    if (!el || columns === null) return;
    const byVisitor = (by: number) => {
      autoplay.current.stopped = true;
      if (sliding.current) return;
      setSlide({ index: Math.max(0, Math.min(lastIndex(columns), current.current + by)), duration: 500 });
    };
    const arrowOf = (event: Event) => (event.target as HTMLElement).closest(".ti-prev, .ti-next");
    const onClick = (event: MouseEvent) => {
      const arrow = arrowOf(event);
      if (arrow) byVisitor(arrow.classList.contains("ti-next") ? 1 : -1);
    };
    const onKey = (event: KeyboardEvent) => {
      const arrow = arrowOf(event);
      if (arrow && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        byVisitor(arrow.classList.contains("ti-next") ? 1 : -1);
      }
    };
    let touchX: number | null = null;
    const onTouchStart = (event: TouchEvent) => (touchX = event.touches[0].clientX);
    const onTouchEnd = (event: TouchEvent) => {
      if (touchX === null) return;
      const dx = event.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 30) byVisitor(dx < 0 ? 1 : -1);
    };
    const pause = () => (autoplay.current.paused = true);
    const resume = () => (autoplay.current.paused = false);
    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    // The timer starts when the reviews first come into view (so the first move comes 6s after that).
    let timer = 0;
    const start = () => {
      timer = window.setInterval(() => {
        const state = autoplay.current;
        if (state.stopped || state.paused) return;
        const last = lastIndex(columns);
        if (last === 0) return;
        // Back and forth: turn round at either end.
        if (current.current + state.direction > last || current.current + state.direction < 0) state.direction = -state.direction;
        setSlide({ index: current.current + state.direction, duration: 1000 });
      }, autoplaySeconds * 1000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || timer) return;
      start();
      observer.disconnect();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeEventListener("click", onClick);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      window.clearInterval(timer);
    };
  }, [columns, autoplaySeconds]); // eslint-disable-line react-hooks/exhaustive-deps -- lastIndex() reads the DOM

  const classes = columns === null ? className : `${className.replace(/\s*ti-col-\d+/, "")} ti-col-${columns}`;
  return (
    <div ref={root} className={classes}>
      {children}
    </div>
  );
}
