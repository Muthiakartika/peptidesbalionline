/**
 * How often a popup has been shown in this browser, counted where Elementor Pro counts it on the live
 * site: localStorage "elementor" (a JSON object) → "popup_<id>_times". Using the same place means the
 * counts carry over when the domain moves to the rebuilt site: a visitor who has already seen the age
 * gate 3 times on WordPress doesn't see it again. Used by the age gate (#5870, at most 3 times) and
 * the homepage's "5% off" popup (#5869, at most 5 times).
 */

function readStore(): Record<string, unknown> {
  try {
    const store = JSON.parse(window.localStorage.getItem("elementor") ?? "{}");
    return store && typeof store === "object" ? store : {};
  } catch {
    return {};
  }
}

export function popupTimesShown(id: number): number {
  return Number(readStore()[`popup_${id}_times`] ?? 0) || 0;
}

/** Counts one more showing (Elementor counts when the popup opens). */
export function countPopupShown(id: number) {
  try {
    const store = readStore();
    store[`popup_${id}_times`] = popupTimesShown(id) + 1;
    window.localStorage.setItem("elementor", JSON.stringify(store));
  } catch {
    // Private mode or blocked storage: the popup then counts as never shown.
  }
}
