/**
 * What the live site's accordions do when a title is clicked, on the HTML WordPress printed (the
 * classes and inline styles are the plugins' own, so their CSS keeps working):
 *
 *   * Woodmart's accordion (the FAQ blocks in product descriptions and landing pages), like the
 *     theme's accordion.min.js: one answer open at a time; clicking the open one closes it. The
 *     answer slides in 300 ms and fades with the theme's CSS (opacity 0.25 s).
 *   * Unlimited Elements' "Content Accordion" (/hgh-bali/, /rewards/), like its content_accordion.js:
 *     clicking an open item closes it; with "close others" on, opening one closes the rest. It
 *     slides in the widget's "transition duration" (400 ms there).
 *   * Elementor's "Toggle" (/affiliate-program/), see toggleElementorToggle below.
 */
import { slideDown, slideUp } from "./slide";

/** Woodmart's slide length (accordion.min.js). */
const WOODMART_DURATION = 300;
const WD_ACTIVE = "wd-active";

/** The title clicked inside a Woodmart accordion (.wd-accordion), or null when the click was
 * elsewhere. Only the accordion's own titles count, not those of an accordion nested inside. */
export function woodmartTitleAt(accordion: Element, target: EventTarget | null): HTMLElement | null {
  const title = target instanceof Element ? target.closest<HTMLElement>(".wd-accordion-title") : null;
  return title && title.parentElement?.parentElement === accordion ? title : null;
}

export function toggleWoodmartAccordion(accordion: Element, title: HTMLElement) {
  const titles = [...accordion.querySelectorAll<HTMLElement>(":scope > .wd-accordion-item > .wd-accordion-title")];
  const contents = [...accordion.querySelectorAll<HTMLElement>(":scope > .wd-accordion-item > .wd-accordion-content")];
  const index = title.dataset.accordionIndex;
  const same = (element: HTMLElement) => element.dataset.accordionIndex === index;
  const wasOpen = title.classList.contains(WD_ACTIVE) || titles.some((t) => same(t) && t.classList.contains(WD_ACTIVE));

  // Close whatever is open (the theme's n()).
  for (const t of titles) t.classList.remove(WD_ACTIVE);
  for (const content of contents.filter((c) => c.classList.contains(WD_ACTIVE))) {
    slideUp(content, WOODMART_DURATION);
    content.classList.remove(WD_ACTIVE);
  }
  if (wasOpen) return;
  // Open the clicked one (the theme's a()).
  for (const t of titles.filter(same)) t.classList.add(WD_ACTIVE);
  for (const content of contents.filter(same)) {
    slideDown(content, WOODMART_DURATION);
    content.classList.add(WD_ACTIVE);
  }
}

/**
 * Elementor's "Toggle" widget (/affiliate-program/), like Elementor's toggle handler: clicking a
 * title opens its answer or closes it again; the others stay as they are. The answer slides in and
 * out in 400 ms; the title's ARIA attributes and the answer's `hidden` follow, as live.
 */
const EL_ACTIVE = "elementor-active";
const TOGGLE_DURATION = 400;

/** The title clicked (or reached with the keyboard) inside a toggle (.elementor-toggle), or null. */
export function toggleTitleAt(toggle: Element, target: EventTarget | null): HTMLElement | null {
  const title = target instanceof Element ? target.closest<HTMLElement>(".elementor-tab-title") : null;
  return title && title.parentElement?.parentElement === toggle ? title : null;
}

export function toggleElementorToggle(toggle: Element, title: HTMLElement) {
  const tab = title.dataset.tab;
  const content = [...toggle.querySelectorAll<HTMLElement>(":scope > .elementor-toggle-item > .elementor-tab-content")].find((c) => c.dataset.tab === tab);
  if (!content) return;
  const open = !title.classList.contains(EL_ACTIVE);
  title.classList.toggle(EL_ACTIVE, open);
  content.classList.toggle(EL_ACTIVE, open);
  title.setAttribute("tabindex", open ? "0" : "-1");
  title.setAttribute("aria-selected", String(open));
  title.setAttribute("aria-expanded", String(open));
  // Elementor sets `hidden` on a closed answer right away. Here the site's base CSS (Tailwind) makes
  // `hidden` win over everything ("display: none !important"), which would cut the slide short, so
  // it is set when the answer has slid shut, and removed before it slides open. Same look as live.
  if (open) {
    content.removeAttribute("hidden");
    slideDown(content, TOGGLE_DURATION);
  } else {
    slideUp(content, TOGGLE_DURATION, () => {
      if (!content.classList.contains(EL_ACTIVE)) content.setAttribute("hidden", "hidden");
    });
  }
}

const UC_ACTIVE = "uc-item-active";

/** The trigger clicked inside a Content Accordion (.uc_material_accordion), or null. */
export function contentAccordionTriggerAt(accordion: Element, target: EventTarget | null): HTMLElement | null {
  const trigger = target instanceof Element ? target.closest<HTMLElement>(".uc_trigger") : null;
  return trigger && trigger.closest(".uc_material_accordion") === accordion ? trigger : null;
}

export function toggleContentAccordion(trigger: HTMLElement, { closeOthers, duration }: { closeOthers: boolean; duration: number }) {
  const item = trigger.parentElement;
  const content = trigger.nextElementSibling;
  if (!item || !(content instanceof HTMLElement)) return;
  if (item.classList.contains(UC_ACTIVE)) {
    item.classList.remove(UC_ACTIVE);
    slideUp(content, duration);
    return;
  }
  if (closeOthers && item.parentElement) {
    for (const other of item.parentElement.children) {
      if (other === item || !other.classList.contains(UC_ACTIVE)) continue;
      other.classList.remove(UC_ACTIVE);
      const otherContent = other.querySelector<HTMLElement>(":scope > .uc_content");
      if (otherContent) slideUp(otherContent, duration);
    }
  }
  item.classList.add(UC_ACTIVE);
  slideDown(content, duration);
}
