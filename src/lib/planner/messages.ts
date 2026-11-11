/**
 * The English texts the live server prints for the planner's stable codes, where they differ from the
 * texts inside the copied engine (./engine.js, ./units.js). The plugin's server translates its answers
 * through its own message list ("Api\Messages", not public), which says "uses" and "protocol" in a
 * few places where the engine still says "events" and "plan". Each text below was read from a live
 * POST /calculate answer on 11 Nov 2026 (src/lib/planner/fixtures/calculate/), except
 * bundle_coverage_applied, which no live product can trigger (the shop sells no mapped bundle): its
 * text follows the same "plan" -> "protocol" change, as in the plugin's browser texts (messages.js).
 * Every other code keeps the engine's text, which live prints unchanged.
 */

const NOTICES: Record<string, string> = {
  event_count_explicit: "Number of uses = times per period × number of periods, exactly as entered.",
  end_date_exclusive: "The end date is the first day after the protocol; the last day of the protocol is the day before it.",
  estimate_excludes_tax_shipping_discounts: "Estimates use current store prices and exclude shipping, taxes and discounts. WooCommerce calculates the final total in your cart and at checkout.",
  bundle_coverage_applied: "Units supplied by a bundle in this protocol were subtracted from the required quantity.",
};

const ERRORS: Record<string, string> = {
  quantity_too_large: "The calculation exceeds the supported size. Reduce the amount, the number of uses or the quantity.",
  product_not_found: "This product could not be found.",
};

/** "A protocol can have at most 25 items. …" (the request-level error of POST /calculate). */
export const tooManyLinesMessage = (max: number) => `A protocol can have at most ${max} items. Remove some items and try again.`;

type Coded = { code: string; message: string };

/** The live text of an assumption or warning. */
export function noticeMessage<T extends Coded>(notice: T): T {
  return Object.hasOwn(NOTICES, notice.code) ? { ...notice, message: NOTICES[notice.code] } : notice;
}

/** The live text of a validation or calculation error. */
export function errorMessage<T extends Coded>(error: T): T {
  return Object.hasOwn(ERRORS, error.code) ? { ...error, message: ERRORS[error.code] } : error;
}

/** A result or timeline from the engine with the live texts in its assumptions and warnings. */
export function withLiveNotices<T extends { assumptions: Coded[]; warnings: Coded[] }>(value: T): T {
  return { ...value, assumptions: value.assumptions.map(noticeMessage), warnings: value.warnings.map(noticeMessage) };
}
