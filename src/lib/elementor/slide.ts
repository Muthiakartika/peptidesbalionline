/**
 * jQuery's slideDown() / slideUp(), which the live site's accordions use (the Woodmart FAQ blocks,
 * the Unlimited Elements "Content Accordion"), redone with the browser's Web Animations API:
 * the element's height, vertical padding and vertical margin grow from 0 (or shrink to 0) with
 * jQuery's "swing" easing, clipped (overflow: hidden) while they move.
 *
 * As with jQuery, an opened element keeps an inline `display: block` and a closed one
 * `display: none`, and starting a slide first finishes the one still running (jQuery's
 * `.stop(true, true)`, which both accordions call).
 */

/** jQuery's "swing" easing, and as a CSS easing (21 points of the curve). */
export const swing = (p: number) => 0.5 - Math.cos(p * Math.PI) / 2;
export const SWING = `linear(${Array.from({ length: 21 }, (_, i) => swing(i / 20).toFixed(4)).join(", ")})`;

/** The properties jQuery animates for a vertical slide. */
type Box = Record<"height" | "paddingTop" | "paddingBottom" | "marginTop" | "marginBottom", string>;

const ZERO: Box = { height: "0px", paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px" };

/** The slide running on each element, and what to do when it ends (or is cut short). */
const running = new WeakMap<HTMLElement, { animation: Animation; end: () => void }>();

function finishRunning(element: HTMLElement) {
  const slide = running.get(element);
  if (!slide) return;
  running.delete(element);
  slide.animation.cancel();
  slide.end();
}

function measure(element: HTMLElement): Box {
  const style = getComputedStyle(element); // also applies any style change made just before
  return { height: style.height, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, marginTop: style.marginTop, marginBottom: style.marginBottom };
}

function animate(element: HTMLElement, from: Box, to: Box, duration: number, end: () => void) {
  const overflow = element.style.overflow;
  element.style.overflow = "hidden";
  const animation = element.animate([from, to], { duration, easing: SWING });
  const slide = {
    animation,
    end: () => {
      element.style.overflow = overflow;
      end();
    },
  };
  running.set(element, slide);
  animation.onfinish = () => {
    if (running.get(element) !== slide) return;
    running.delete(element);
    slide.end();
  };
}

/** Shows the element by sliding it open. Its styles are read right after it's shown (as jQuery
 * does), so a class added just after the call starts that class's CSS transitions, as on the live
 * site (the Woodmart answer fades in while it slides). */
export function slideDown(element: HTMLElement, duration: number) {
  finishRunning(element);
  element.style.display = "block";
  animate(element, ZERO, measure(element), duration, () => {});
}

/** Hides the element by sliding it closed. It stays shown until the slide ends, so a class removed
 * just after the call starts that class's CSS transitions (the Woodmart answer fades out). `done`
 * runs when it is closed (also when a new slide cuts this one short). */
export function slideUp(element: HTMLElement, duration: number, done?: () => void) {
  finishRunning(element);
  if (getComputedStyle(element).display === "none") {
    element.style.display = "none";
    done?.();
    return;
  }
  element.style.display = "block";
  animate(element, measure(element), ZERO, duration, () => {
    element.style.display = "none";
    done?.();
  });
}

/** The page scroll running, if any (jQuery's `$("html, body").stop().animate({ scrollTop })`). */
let scrolling = 0;

/** Scrolls the page to `top` in `duration` ms with the "swing" easing, stopping a scroll still
 * running, as the theme's scripts do with jQuery (e.g. the "Register" switch on /my-account/). */
export function animateScrollTop(top: number, duration: number) {
  cancelAnimationFrame(scrolling);
  const from = window.scrollY;
  const start = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + (top - from) * swing(progress));
    if (progress < 1) scrolling = requestAnimationFrame(step);
  };
  scrolling = requestAnimationFrame(step);
}
