/**
 * POST /calculate of the planner API: the whole protocol worked out on the server, as the live
 * plugin's PlanCalculator does it. The arithmetic itself is the plugin's own engine (./engine.js,
 * copied unchanged: its header says it mirrors the PHP classes behind live's /calculate exactly);
 * this file does what happens around it on the server, read from the plugin's browser code
 * (app.js, plan.js) and from live answers (src/lib/planner/fixtures/calculate/, 11 Nov 2026):
 *
 *   1. the request: `lines` must be a list (at most `max_lines`, 25), `start_date` a real date or null;
 *   2. each line is checked (validateLine); a line that fails gets its errors and no product;
 *   3. its product and option are looked up (a variable product needs its variation; unknown ->
 *      "product_not_found"); an option without store-verified data gets its readiness code
 *      ("needs_mapping", with the product, no result);
 *   4. bundles in the protocol cover units of their component products (bundleCoverage, below);
 *   5. the engine calculates the line (calculateLine) with the shop's current price; stock is added
 *      as a warning ("out_of_stock", "on_backorder"); a schedule line also gets its inventory timeline
 *      (buildTimeline) from its own start date or the protocol's;
 *   6. the totals add up the lines that calculated.
 * Texts are the live server's (./messages.ts).
 */
import "server-only";

import { buildTimeline, calculateLine, CalculationError, dateError, notice, priceSum, validateLine, ValidationError } from "./engine.js";
import { PLANNABLE, plannerSettings, timestamp, type PlannerProduct, type PlannerUnit } from "./data";
import { errorMessage, tooManyLinesMessage, withLiveNotices } from "./messages";

/** The store's limits (live GET /session `limits`). */
export const LIMITS = plannerSettings.limits;
export const MAX_LINES = LIMITS.max_lines ?? 25;
const PRICE_DECIMALS = plannerSettings.currency.decimals;

type Problem = { field: string; code: string; message: string };

/** The product part of a line's answer (what the browser needs to show the line). */
export function productEntry(unit: PlannerUnit) {
  return {
    product_id: unit.product_id,
    variation_id: unit.variation_id,
    name: unit.name,
    parent_name: unit.parent_name,
    attribute_labels: unit.attribute_labels,
    image: unit.image,
    permalink: unit.permalink,
    price: unit.price,
    stock_status: unit.stock_status,
    readiness: unit.readiness,
  };
}

export type LineEntry = {
  id: string;
  ok: boolean;
  errors: Problem[];
  product: ReturnType<typeof productEntry> | null;
  result: CalculatedResult | null;
  timeline: Record<string, unknown> | null;
};

/** The parts of the engine's result this file reads (the engine returns many more). */
export type CalculatedResult = { mode: string; quantity: number; estimate: string | null; bundle_covered_units: number; assumptions: { code: string; message: string }[]; warnings: { code: string; message: string }[] } & Record<string, unknown>;

type Line = { id: string; product_id: number; variation_id: number; mode: string; manual_quantity: number | null } & Record<string, unknown>;

/** The option a line points at, or the error that says why there is none. */
function unitOf(line: Line, products: Map<number, PlannerProduct>): { unit: PlannerUnit } | { problem: Problem } {
  const notFound = (field: string) => ({ problem: errorMessage({ field, code: "product_not_found", message: "" }) });
  const product = products.get(line.product_id);
  if (!product) return notFound("product_id");
  if (product.type === "variable") {
    // A variable product is always planned as one of its variations (live: variation 0 -> not found).
    if (line.variation_id === 0) return notFound("product_id");
    const unit = product.units.find((u) => u.variation_id === line.variation_id);
    return unit ? { unit } : notFound("variation_id");
  }
  const unit = line.variation_id === 0 ? product.units.find((u) => u.variation_id === 0) : undefined;
  return unit ? { unit } : notFound(line.variation_id === 0 ? "product_id" : "variation_id");
}

type Prepared = { raw: unknown; line: Line | null; unit: PlannerUnit | null; entry: LineEntry | null };

/** Steps 2 and 3: the line checked and its option found, or its final (failed) answer. */
function prepare(raw: unknown, products: Map<number, PlannerProduct>): Prepared {
  const rawId = raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : "";
  const failed = (errors: Problem[], product: LineEntry["product"] = null): LineEntry => ({ id: rawId, ok: false, errors, product, result: null, timeline: null });
  const validation = validateLine(raw, LIMITS);
  if (!validation.ok) return { raw, line: null, unit: null, entry: failed((validation.errors as Problem[]).map(errorMessage)) };
  const line = validation.line as Line;
  const found = unitOf(line, products);
  if ("problem" in found) return { raw, line, unit: null, entry: failed([found.problem]) };
  const { unit } = found;
  if (!PLANNABLE.includes(unit.readiness)) {
    return { raw, line, unit, entry: failed([{ field: unit.variation_id > 0 ? "variation_id" : "product_id", code: unit.readiness, message: unit.readiness_message }], productEntry(unit)) };
  }
  return { raw, line, unit, entry: null };
}

/** Step 5 for one line: the engine's result (or its error), with stock warnings and the timeline. */
function calculate(prepared: Prepared, covered: number, planStart: string | null): LineEntry {
  if (prepared.entry) return prepared.entry;
  const line = prepared.line as Line;
  const unit = prepared.unit as PlannerUnit;
  const product = productEntry(unit);
  // Keys in live's order: id, ok, errors, product, result, timeline.
  const failed = (errors: Problem[]): LineEntry => ({ id: line.id, ok: false, errors: errors.map(errorMessage), product, result: null, timeline: null });
  if (!unit.modes.includes(line.mode)) {
    const error = new CalculationError("mode_not_allowed");
    return failed([{ field: "", code: error.code, message: error.message }]);
  }
  let result: CalculatedResult;
  try {
    result = calculateLine(line, unit.capacities, unit.pack_count ?? 1, unit.price, PRICE_DECIMALS, covered) as CalculatedResult;
  } catch (error) {
    if (error instanceof CalculationError) return failed([{ field: "", code: error.code, message: error.message }]);
    if (error instanceof ValidationError) return failed(error.errors as Problem[]);
    throw error;
  }
  if (unit.stock_status === "outofstock") result.warnings.push(notice("out_of_stock"));
  if (unit.stock_status === "onbackorder") result.warnings.push(notice("on_backorder"));
  let timeline: Record<string, unknown> | null = null;
  if (result.mode === "schedule") {
    try {
      timeline = withLiveNotices(buildTimeline(line, result, planStart) as { assumptions: { code: string; message: string }[]; warnings: { code: string; message: string }[] });
    } catch (error) {
      if (error instanceof CalculationError) return failed([{ field: "", code: error.code, message: error.message }]);
      throw error;
    }
  }
  return { id: line.id, ok: true, errors: [], product, result: withLiveNotices(result), timeline };
}

/**
 * Step 4, the plugin's bundle rule (plan.js bundleCoverage(), "the mirror of PlanCalculator's rule"):
 * a manual bundle line that calculates supplies quantity × component quantity units of each product
 * in it; those are offered, in protocol order, to the schedule / direct lines of that product and
 * option, each taking at most what it needs. Returns line id -> units offered to it.
 */
function bundleCoverage(prepared: Prepared[], planStart: string | null): Map<string, number> {
  const supplied = new Map<string, number>();
  for (const item of prepared) {
    const components = item.unit?.mapping?.component_composition ?? [];
    if (item.entry || !item.line || item.line.mode !== "manual" || item.unit?.container_type !== "bundle" || !components.length) continue;
    if (!calculate(item, 0, planStart).ok) continue;
    for (const component of components) {
      const key = `${component.product_id}:${component.variation_id ?? 0}`;
      supplied.set(key, (supplied.get(key) ?? 0) + (item.line.manual_quantity ?? 0) * component.quantity);
    }
  }
  const coverage = new Map<string, number>();
  if (!supplied.size) return coverage;
  for (const item of prepared) {
    if (item.entry || !item.line || (item.line.mode !== "schedule" && item.line.mode !== "direct")) continue;
    const key = `${item.line.product_id}:${item.line.variation_id}`;
    const remaining = supplied.get(key) ?? 0;
    if (remaining <= 0) continue;
    const outcome = calculate(item, remaining, planStart);
    if (!outcome.ok || !outcome.result) continue;
    coverage.set(item.line.id, remaining);
    supplied.set(key, remaining - Math.min(remaining, Math.max(0, outcome.result.bundle_covered_units)));
  }
  return coverage;
}

export type CalculateAnswer = { status: number; body: Record<string, unknown> };

const invalidRequest = (errors: Problem[]): CalculateAnswer => ({
  status: 400,
  body: { code: "arp_invalid_request", message: "The request could not be processed. Please reload the page and try again.", data: { errors, status: 400 } },
});

/** The answer of POST /calculate for a JSON body (status and body). */
export function calculatePlan(body: unknown, products: Map<number, PlannerProduct>, now = new Date()): CalculateAnswer {
  const request = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  // WordPress's own checks of the route's arguments first.
  if (!("lines" in request)) return { status: 400, body: { code: "rest_missing_callback_param", message: "Missing parameter(s): lines", data: { status: 400, params: ["lines"] } } };
  if (!Array.isArray(request.lines)) return { status: 400, body: { code: "rest_invalid_param", message: "Invalid parameter(s): lines", data: { status: 400, params: { lines: "Invalid parameter." }, details: [] } } };
  const start = request.start_date ?? null;
  if (start !== null && typeof start !== "string") {
    const message = "start_date is not of type string,null.";
    return { status: 400, body: { code: "rest_invalid_param", message: "Invalid parameter(s): start_date", data: { status: 400, params: { start_date: message }, details: { start_date: { code: "rest_invalid_type", message, data: { param: "start_date" } } } } } };
  }
  // Then the planner's own.
  const problems: Problem[] = [];
  if (request.lines.length > MAX_LINES) problems.push({ field: "lines", code: "too_many_lines", message: tooManyLinesMessage(MAX_LINES) });
  const planStart = start === "" ? null : start;
  const dateProblem = planStart === null ? null : (dateError(planStart) as string | null);
  if (dateProblem) {
    problems.push(errorMessage(ValidationError.single("start_date", dateProblem).errors[0] as Problem));
  }
  if (problems.length) return invalidRequest(problems);

  const prepared = request.lines.map((raw) => prepare(raw, products));
  const coverage = bundleCoverage(prepared, planStart);
  const lines = prepared.map((item) => calculate(item, item.line ? (coverage.get(item.line.id) ?? 0) : 0, planStart));

  const calculated = lines.filter((line) => line.ok && line.result);
  const estimates = calculated.map((line) => line.result?.estimate).filter((estimate): estimate is string => typeof estimate === "string");
  return {
    status: 200,
    body: {
      lines,
      totals: {
        estimate: estimates.length ? (priceSum(estimates, PRICE_DECIMALS) as string) : null,
        currency: plannerSettings.currency,
        line_count: calculated.length,
        unit_count: calculated.reduce((sum, line) => sum + (line.result?.quantity ?? 0), 0),
      },
      warnings: [],
      calculated_at: timestamp(now),
      price_basis: "display_estimate",
    },
  };
}
