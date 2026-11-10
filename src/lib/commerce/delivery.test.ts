/** The delivery slot choices, as the owner's snippet builds them (UTC dates, WordPress labels). */
import { describe, expect, it } from "vitest";

import { deliveryDayOptions, deliveryTimeOptions } from "./delivery";

describe("delivery slots", () => {
  it("offers today and the next 7 days in UTC, labelled like WordPress", () => {
    const days = deliveryDayOptions(new Date("2026-11-06T23:30:00Z"));
    expect(days[0]).toEqual({ value: "", label: "Choose a delivery day" });
    expect(days.slice(1, 4)).toEqual([
      { value: "2026-11-06", label: "Today" },
      { value: "2026-11-07", label: "Tomorrow" },
      { value: "2026-11-08", label: "Sunday, 8 November" },
    ]);
    expect(days).toHaveLength(9);
    expect(days.at(-1)).toEqual({ value: "2026-11-13", label: "Friday, 13 November" });
  });

  it("has the six time windows with an en dash", () => {
    expect(deliveryTimeOptions().map((o) => o.label)).toEqual(["Choose a time", "07:00–09:00", "09:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–21:00", "21:00–23:00"]);
  });
});
