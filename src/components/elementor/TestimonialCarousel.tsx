"use client";

/**
 * The Elementor Pro "Testimonial Carousel" ("What Our Customers Say"): one quote at a time, sliding.
 * It runs the same library as on the live site, Swiper 8.4.5, with the options Elementor Pro passes
 * to it (its "base carousel" handler, read from the live script):
 *
 *   * one slide in view, 10px apart, endless loop, 0.5s slide, grab cursor, clickable bullets;
 *   * autoplay every 5s, stopped for good once the visitor drags or clicks a bullet
 *     ("pause on interaction"), and paused while the pointer is over it ("pause on hover":
 *     Elementor stops autoplay on mouseenter and starts it again on mouseleave);
 *   * Swiper's accessibility module labels the slides "1 / 3" etc., as on the live site.
 *
 * The slides are the widget's own HTML, so Elementor's CSS styles them unchanged (Swiper's CSS is in
 * src/styles/legacy/elementor-core.css). The classes Elementor adds when the carousel starts
 * (e-widget-swiper, e-swiper-container) are printed by ElementorContent from the start.
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import Swiper, { A11y, Autoplay, Pagination } from "swiper";

type Size = { size?: number | string };
export type TestimonialSettings = {
  speed?: number;
  autoplay?: string;
  autoplay_speed?: number;
  loop?: string;
  pause_on_hover?: string;
  pause_on_interaction?: string;
  pagination?: string;
  space_between?: Size;
};

export function TestimonialCarousel({ attributes, settings, children }: { attributes: HTMLAttributes<HTMLDivElement>; settings: TestimonialSettings; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.querySelectorAll(".swiper-slide").length <= 1) return;
    const pagination = el.querySelector<HTMLElement>(".swiper-pagination");
    const swiper = new Swiper(el, {
      modules: [A11y, Autoplay, Pagination],
      grabCursor: true,
      initialSlide: 0,
      slidesPerView: 1,
      slidesPerGroup: 1,
      spaceBetween: Number(settings.space_between?.size ?? 10),
      loop: settings.loop === "yes",
      speed: settings.speed ?? 500,
      effect: "slide",
      preventClicksPropagation: false,
      slideToClickedSlide: true,
      pagination: settings.pagination && pagination ? { el: pagination, type: settings.pagination as "bullets", clickable: true } : false,
      autoplay: settings.autoplay === "yes" ? { delay: settings.autoplay_speed ?? 5000, disableOnInteraction: Boolean(settings.pause_on_interaction) } : false,
    });
    const stop = () => swiper.autoplay?.stop();
    const start = () => swiper.autoplay?.start();
    const hover = settings.autoplay === "yes" && settings.pause_on_hover === "yes";
    if (hover) {
      el.addEventListener("mouseenter", stop);
      el.addEventListener("mouseleave", start);
    }
    return () => {
      if (hover) {
        el.removeEventListener("mouseenter", stop);
        el.removeEventListener("mouseleave", start);
      }
      swiper.destroy(true, true);
    };
  }, [settings]);

  return (
    <div ref={ref} {...attributes}>
      {children}
    </div>
  );
}
