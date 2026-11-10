/**
 * Where the homepage's age gate (src/components/layout/AgeGate.tsx) stands on this visit, so the
 * "5% off" popup (#5869) can wait for it. Owner's decision of 6 Nov 2026 (a change from the live
 * site, where both popups have their own triggers and can open on top of each other):
 *
 *   * "waiting":   the age gate is about to open, or is open → the offer must not open yet;
 *   * "confirmed": the visitor clicked "I'm 21+" → the offer opens a few seconds later;
 *   * "not-shown": the age gate doesn't open on this visit (already shown its 3 times) → the offer
 *     uses its own live trigger (scrolling down).
 *
 * "Take me back" changes nothing (on the live site it is a link to "#" with no action, Q-10), so the
 * offer stays closed while the age gate is open.
 * The state lives in this module (one per browser tab) and goes back to "waiting" when the age gate
 * leaves the page, so a later visit to the homepage waits again.
 */
export type AgeGateState = "waiting" | "confirmed" | "not-shown";

type Listener = (state: AgeGateState) => void;

let current: AgeGateState = "waiting";
const listeners = new Set<Listener>();

export function ageGateState(): AgeGateState {
  return current;
}

export function setAgeGateState(next: AgeGateState) {
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener(next);
}

/** Calls `listener` on every change; returns the function that stops it. */
export function onAgeGateState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
