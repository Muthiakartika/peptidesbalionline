/**
 * The hero's dispatch countdown counts to 5 PM Bali time (UTC+8), today's or tomorrow's.
 */
import { describe, expect, it } from "vitest";

import { nextCutoff } from "./DispatchPanel";

const utc = (iso: string) => Date.parse(`${iso}Z`);

describe("nextCutoff", () => {
  it("is today's 5 PM in Bali (09:00 UTC) before it", () => {
    // 10:00 in Bali = 02:00 UTC
    expect(nextCutoff(utc("2026-11-13T02:00:00"), 17)).toEqual({ at: utc("2026-11-13T09:00:00"), today: true });
  });
  it("is tomorrow's after it", () => {
    // 18:30 in Bali = 10:30 UTC
    expect(nextCutoff(utc("2026-11-13T10:30:00"), 17)).toEqual({ at: utc("2026-11-14T09:00:00"), today: false });
  });
  it("uses Bali's date, not UTC's, just after midnight in Bali", () => {
    // 00:30 on 14 Nov in Bali = 16:30 UTC on 13 Nov
    expect(nextCutoff(utc("2026-11-13T16:30:00"), 17)).toEqual({ at: utc("2026-11-14T09:00:00"), today: true });
  });
});
