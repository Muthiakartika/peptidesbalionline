/**
 * Answers in the shape of the WordPress REST API, which the Protocol Builder's script (planner.js)
 * was written against: errors are { code, message, data: { status, … } }, and the request arguments
 * are checked the way WordPress checks a route's argument schema (same codes and English messages,
 * e.g. "per_page must be between 1 (inclusive) and 48 (inclusive)"). Checked against the live site
 * on 11 Nov 2026 (src/lib/planner/fixtures/).
 */

/** Every answer of the planner API: never cached (live sends the same), never indexed. */
const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

/** A WordPress REST error: { code, message, data: { status, …extra } }. */
export function restError(code: string, message: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ code, message, data: { status, ...extra } }, status);
}

/** WordPress's answer for an address the API doesn't have (or a method it doesn't answer). */
export const noRoute = () => restError("rest_no_route", "No route was found matching the URL and request method.", 404);

/** WordPress's answer when a route's permission check fails: 401 for a visitor, 403 when logged in. */
export const forbidden = (loggedIn: boolean) => restError("rest_forbidden", "Sorry, you are not allowed to do that.", loggedIn ? 403 : 401);

/** The planner's answer for a POST without a valid public nonce (see ./session.ts). */
export const badNonce = () => restError("arp_bad_nonce", "Your session has expired. Please reload the page and try again.", 403);

/** A body that isn't JSON (WordPress: rest_invalid_json). */
export const invalidJson = () => restError("rest_invalid_json", "Invalid JSON body passed.", 400, { json_error_code: 4, json_error_message: "Syntax error" });

// ---------------------------------------------------------------------------------------------
// Request arguments, checked as WordPress checks them (rest_validate_value_from_schema).
// ---------------------------------------------------------------------------------------------

export type ArgSchema =
  | { type: "integer"; default: number; minimum?: number; maximum?: number }
  | { type: "string"; default: string; maxLength?: number; pattern?: string; enum?: string[] };

type ArgProblem = { code: string; message: string };

/** WordPress lists enum values as "a, b, and c" (wp_sprintf_l), an empty value as nothing. */
function listing(values: string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

/** One argument's value (from the query string) checked against its schema: the value, or the problem. */
function check(name: string, raw: string, schema: ArgSchema): { value: string | number } | { problem: ArgProblem } {
  if (schema.type === "integer") {
    // WordPress accepts "12" and "12.0" but not "1.5" or "abc".
    const number = Number(raw.trim());
    if (raw.trim() === "" || !Number.isFinite(number) || !Number.isInteger(number)) {
      return { problem: { code: "rest_invalid_type", message: `${name} is not of type integer.` } };
    }
    const { minimum, maximum } = schema;
    if ((minimum !== undefined && number < minimum) || (maximum !== undefined && number > maximum)) {
      const message =
        minimum !== undefined && maximum !== undefined
          ? `${name} must be between ${minimum} (inclusive) and ${maximum} (inclusive)`
          : minimum !== undefined
            ? `${name} must be greater than or equal to ${minimum}`
            : `${name} must be less than or equal to ${maximum}`;
      return { problem: { code: "rest_out_of_bounds", message } };
    }
    return { value: number };
  }
  if (schema.enum && !schema.enum.includes(raw)) {
    return { problem: { code: "rest_not_in_enum", message: `${name} is not one of ${listing(schema.enum)}.` } };
  }
  // WordPress counts characters (mb_strlen), not bytes.
  if (schema.maxLength !== undefined && [...raw].length > schema.maxLength) {
    return { problem: { code: "rest_too_long", message: `${name} must be at most ${schema.maxLength} character${schema.maxLength === 1 ? "" : "s"} long.` } };
  }
  if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(raw)) {
    return { problem: { code: "rest_invalid_pattern", message: `${name} does not match pattern ${schema.pattern}.` } };
  }
  return { value: raw };
}

/**
 * The query string's arguments, with their defaults, or WordPress's 400 "rest_invalid_param" answer
 * listing every argument that failed (unknown arguments are ignored, as WordPress does).
 */
export function readArgs<T extends Record<string, ArgSchema>>(
  query: URLSearchParams,
  schemas: T,
): { ok: true; args: { [K in keyof T]: T[K]["default"] } } | { ok: false; response: Response } {
  const args: Record<string, string | number> = {};
  const params: Record<string, string> = {};
  const details: Record<string, { code: string; message: string; data: { param: string } | null }> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const raw = query.get(name);
    if (raw === null) {
      args[name] = schema.default;
      continue;
    }
    const result = check(name, raw, schema);
    if ("problem" in result) {
      params[name] = result.problem.message;
      // WordPress adds the argument's name to a type error only (checked on live).
      details[name] = { ...result.problem, data: result.problem.code === "rest_invalid_type" ? { param: name } : null };
    } else {
      args[name] = result.value;
    }
  }
  const failed = Object.keys(params);
  if (failed.length) {
    return { ok: false, response: restError("rest_invalid_param", `Invalid parameter(s): ${failed.join(", ")}`, 400, { params, details }) };
  }
  return { ok: true, args: args as { [K in keyof T]: T[K]["default"] } };
}
