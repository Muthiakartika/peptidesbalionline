/**
 * The products this visitor has opened, most recent first (the live theme keeps the same list in a
 * cookie for its "Recently viewed products" grid). Stored in this browser only; nothing is sent to
 * the server except the ids when the grid asks for the cards.
 */
const KEY = "atlas-recently-viewed";
const MAX = 15;

export function readRecentlyViewed(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

export function rememberViewed(productId: number): void {
  try {
    const ids = [productId, ...readRecentlyViewed().filter((id) => id !== productId)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // storage blocked (private mode): the grid simply stays empty
  }
}
