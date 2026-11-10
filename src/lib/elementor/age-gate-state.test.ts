/**
 * The age gate's state, which the homepage's "5% off" popup waits for (owner's decision of 6 Nov 2026).
 */
import { describe, expect, it } from "vitest";

import { ageGateState, onAgeGateState, setAgeGateState, type AgeGateState } from "./age-gate-state";

describe("age gate state", () => {
  it("starts as waiting, tells listeners about each change once, and stops when asked", () => {
    expect(ageGateState()).toBe("waiting");
    const seen: AgeGateState[] = [];
    const stop = onAgeGateState((state) => seen.push(state));
    setAgeGateState("confirmed");
    setAgeGateState("confirmed");
    setAgeGateState("waiting");
    stop();
    setAgeGateState("not-shown");
    expect(seen).toEqual(["confirmed", "waiting"]);
    expect(ageGateState()).toBe("not-shown");
    setAgeGateState("waiting");
  });
});
