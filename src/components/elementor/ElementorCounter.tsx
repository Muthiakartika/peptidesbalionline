"use client";

/**
 * Elementor counter number ("5,000+ Successful Deliveries"): starts at `from` and counts up to `to`
 * when it scrolls into view, like Elementor's counter (jQuery numerator: "swing" easing).
 */
import { useEffect, useRef, useState } from "react";

const swing = (p: number) => 0.5 - Math.cos(p * Math.PI) / 2;
const decimalsOf = (n: number) => (String(n).split(".")[1] ?? "").length;

/** As Elementor: as many decimals as the target value has ("4.9" stays 4.9, not 5). */
function format(value: number, delimiter: string, decimals: number): string {
  const [whole, fraction] = value.toFixed(decimals).split(".");
  const grouped = delimiter ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, delimiter) : whole;
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function ElementorCounter({ from, to, duration, delimiter }: { from: number; to: number; duration: number; delimiter: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        setValue(from + (to - from) * swing(progress));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [from, to, duration]);
  return (
    <span ref={ref} className="elementor-counter-number" data-duration={duration} data-to-value={to} data-from-value={from} data-delimiter={delimiter}>
      {format(value, delimiter, decimalsOf(to))}
    </span>
  );
}
