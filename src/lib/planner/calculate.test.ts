/**
 * POST /calculate against the live plugin: 12 requests sent to https://peptidesbali.online on
 * 11 Nov 2026 and their answers (./fixtures/calculate/p01–p12.json). Each is calculated here from the
 * planner's products as live printed them that day (./fixtures/calculate/products.json: a frozen copy
 * from the snapshot, so a newer snapshot with other prices doesn't change the test) and must give
 * exactly live's answer. Only the time of the calculation differs, and the product links, which this site
 * keeps relative ("/product/bpc-157/" instead of "https://peptidesbali.online/product/bpc-157/").
 *
 * The plans cover: mg / mcg / IU amounts, day, week and month periods, a protocol start date and line
 * start dates, direct and manual lines, chosen quantities below the calculated one (shortfall),
 * options that need mapping, out of stock and on backorder, a 3000-day line (an aggregated timeline,
 * more than 500 containers), too large a calculation, line errors of every kind and the request
 * errors (too many lines, `lines` not a list, an impossible start date).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { calculatePlan } from "./calculate";
import type { PlannerProduct } from "./data";

const dir = path.join(__dirname, "fixtures", "calculate");
const fixtures = readdirSync(dir)
  .filter((name) => /^p\d+\.json$/.test(name))
  .sort()
  .map((name) => ({ name, ...(JSON.parse(readFileSync(path.join(dir, name), "utf8")) as { request: unknown; status: number; response: Record<string, unknown> }) }));

/** An answer as JSON text (so the keys' order counts too), with relative product links and no
 * calculation time. */
function comparable(value: unknown): string {
  return JSON.stringify(value, (key, v) => (key === "calculated_at" ? undefined : v)).replace(/"https:\/\/peptidesbali\.online(\/product\/[^"]*)"/g, '"$1"');
}

describe("POST /calculate", () => {
  const frozen = JSON.parse(readFileSync(path.join(dir, "products.json"), "utf8")) as Record<string, PlannerProduct>;
  const products = new Map(Object.values(frozen).map((product) => [product.id, product]));

  it("has the live requests", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(12);
  });

  for (const fixture of fixtures) {
    it(`gives live's answer for ${fixture.name}`, () => {
      const answer = calculatePlan(fixture.request, products, new Date("2026-11-11T03:30:00Z"));
      expect(answer.status).toBe(fixture.status);
      expect(comparable(answer.body)).toBe(comparable(fixture.response));
    });
  }

  it("prints the calculation time as live does", () => {
    const answer = calculatePlan(fixtures[0].request, products, new Date("2026-11-11T03:30:00.123Z"));
    expect(answer.body.calculated_at).toBe("2026-11-11T03:30:00Z");
  });

  it("answers WordPress's own argument errors", () => {
    expect(calculatePlan({}, products).body).toMatchObject({ code: "rest_missing_callback_param", data: { status: 400, params: ["lines"] } });
    expect(calculatePlan({ lines: [], start_date: 5 }, products).body).toMatchObject({ code: "rest_invalid_param", data: { params: { start_date: "start_date is not of type string,null." } } });
    const empty = calculatePlan({ lines: [] }, products);
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ lines: [], totals: { estimate: null, line_count: 0, unit_count: 0 } });
  });
});
