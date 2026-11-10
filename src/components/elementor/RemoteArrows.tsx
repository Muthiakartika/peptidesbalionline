"use client";

/**
 * Unlimited Elements "Remote Arrows": prev / next buttons placed elsewhere in the section that move
 * a carousel (OwlCarousel, found by its id). This is the arrows widget itself, with its original
 * attributes and markup; a click on .ue-carousel-prev / .ue-carousel-next sends the carousel an
 * "owl:step" event.
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

export function RemoteArrows({ target, attributes, children }: { target: string; attributes: HTMLAttributes<HTMLDivElement>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onClick = (event: MouseEvent) => {
      const arrow = (event.target as HTMLElement).closest(".ue-carousel-prev, .ue-carousel-next");
      if (!arrow) return;
      const by = arrow.classList.contains("ue-carousel-next") ? 1 : -1;
      document.getElementById(target)?.dispatchEvent(new CustomEvent("owl:step", { detail: by }));
    };
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [target]);
  return (
    <div ref={ref} {...attributes}>
      {children}
    </div>
  );
}
