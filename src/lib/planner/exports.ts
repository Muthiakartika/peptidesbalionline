/**
 * POST /exports of the planner API: the Protocol Builder's "Export" menu for the protocol on screen
 * (planner.js sends the whole protocol; nothing is stored). Three files, as the plugin's readme
 * describes them:
 *
 *   csv    a spreadsheet: one row per item with what was entered and what was calculated, then the
 *          estimated total;
 *   ics    a calendar of all-day "Research inventory review" checkpoints (protocol start, a container
 *          estimated to be used up, estimated run-out, last day): inventory estimates only, never
 *          dosing or administration reminders. Needs a start date;
 *   print  a printable page with the store's name and colours (the browser prints it or saves it as PDF).
 *
 * The live files can't be compared (asking live to make one is not allowed from here), so the columns
 * and layout are this site's own; the numbers are the same POST /calculate gives (./calculate.ts).
 */
import "server-only";

import { createHash } from "node:crypto";

import { business, siteUrl } from "@/lib/site";

import { calculatePlan, type LineEntry } from "./calculate";
import { plannerStoreProtocols, type PlannerProduct } from "./data";

export type ExportAnswer = { status: number; body: Record<string, unknown> } | { status: 200; file: { content: string; type: string; filename: string } };

type Amount = { value: string; unit: string } | null;
type PlanLine = { id: string; product_id: number; variation_id: number; mode: string; amount: string | null; unit: string | null; events_per_period: number | null; period_unit: string | null; periods: number | null; start_date: string | null; label: string };
type Plan = { title: string; start_date: string | null; notes: string; lines: PlanLine[] };

const FORMATS = ["csv", "ics", "print"];
const BRAND = { primary: "#b8952a", strong: "#8a6d16", accent: "#242424", soft: "#f5f0e1" };
const DISCLAIMER =
  "This planner is an arithmetic tool for laboratory inventory and procurement. It does not provide medical advice and does not recommend amounts, schedules or uses. All values are entered by you and are treated as research data. Products are supplied for laboratory research use only.";
const ESTIMATE_NOTE = "Estimates use current store prices and exclude shipping, taxes and discounts. WooCommerce calculates the final total in your cart and at checkout.";
const CHECKPOINTS: Record<string, string> = {
  start: "Protocol start",
  container_depleted: "A container is estimated to be used up",
  run_out: "Estimated run-out",
  end: "Last day of the protocol",
};

const invalid = (name: string, message: string, code: string) => ({
  status: 400,
  body: { code: "rest_invalid_param", message: `Invalid parameter(s): ${name}`, data: { status: 400, params: { [name]: message }, details: { [name]: { code, message, data: null } } } },
});

/** "Rp1,200,000.00" from "1200000.00" (the shop's money format). */
function money(decimal: string | null | undefined): string {
  if (!decimal) return "";
  const [whole, fraction = ""] = decimal.split(".");
  return `Rp${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(fraction + "00").slice(0, 2)}`;
}

const amountText = (amount: Amount | undefined) => (amount ? `${amount.value} ${amount.unit}` : "");

/** "BPC-157 (5 MG)": the product and its option. */
function itemName(entry: LineEntry, line: PlanLine): string {
  const product = entry.product;
  if (!product) return `Product ${line.product_id}`;
  const option = Object.values(product.attribute_labels ?? {}).join(" · ");
  return option ? `${product.parent_name || product.name} (${option})` : product.name;
}

/** "250 mcg, 7 times per week for 8 weeks". */
function planText(line: PlanLine): string {
  if (line.mode === "manual") return "Bought by quantity";
  if (line.mode === "direct") return `Total entered directly: ${line.amount ?? ""} ${line.unit ?? ""}`.trim();
  const plural = (n: number | null, word: string) => `${n ?? ""} ${word}${n === 1 ? "" : "s"}`;
  return `${line.amount ?? ""} ${line.unit ?? ""}, ${line.events_per_period ?? ""} times per ${line.period_unit ?? ""} for ${plural(line.periods, line.period_unit ?? "")}`;
}

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

/** One CSV cell: quoted, and text that a spreadsheet would run as a formula made harmless. */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(plan: Plan, lines: LineEntry[], totals: { estimate: string | null }): string {
  const rows: unknown[][] = [
    ["Item", "Label", "Mode", "Amount per use", "Unit", "Times per period", "Period", "Periods", "Start date", "Total required", "Capacity per unit", "Units to buy", "Containers", "Coverage", "Left over", "Shortfall", "Unit price (IDR)", "Estimate (IDR)", "Status"],
  ];
  plan.lines.forEach((line, index) => {
    const entry = lines[index];
    const result = entry?.result as Record<string, unknown> | null;
    const r = (key: string) => (result ? (result[key] as Amount) : null);
    rows.push([
      entry ? itemName(entry, line) : "",
      line.label,
      line.mode,
      line.mode === "manual" ? "" : line.amount,
      line.mode === "manual" ? "" : line.unit,
      line.mode === "schedule" ? line.events_per_period : "",
      line.mode === "schedule" ? line.period_unit : "",
      line.mode === "schedule" ? line.periods : "",
      line.mode === "schedule" ? (line.start_date ?? plan.start_date ?? "") : "",
      amountText(r("total_required")),
      amountText(r("capacity_per_unit")),
      result ? result.quantity : "",
      result ? result.containers : "",
      amountText(r("coverage")),
      amountText(r("surplus")),
      amountText(r("shortfall")),
      result ? result.unit_price : "",
      result ? result.estimate : "",
      entry?.ok ? "Calculated" : (entry?.errors.map((e) => e.message).join(" ") ?? ""),
    ]);
  });
  rows.push([], ["Estimated total (IDR)", totals.estimate ?? ""], [ESTIMATE_NOTE], [DISCLAIMER]);
  // A byte order mark, so spreadsheet programs read the file as UTF-8 ("×", "–").
  return `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------------------------
// Calendar (.ics)
// ---------------------------------------------------------------------------------------------

/** Text in an iCalendar value: backslash, comma, semicolon and line breaks escaped. */
const icsText = (text: string) => text.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

/** iCalendar lines are at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const nextDay = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
};

function ics(plan: Plan, lines: LineEntry[], now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${business.name}//Protocol Builder//EN`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsText(plan.title || "Research protocol")}`];
  plan.lines.forEach((line, index) => {
    const entry = lines[index];
    const reviews = ((entry?.timeline?.review_events as { date: string; type: string }[] | undefined) ?? []).filter((review) => review.date);
    for (const review of reviews) {
      const uid = createHash("sha1").update(`${plan.title}|${line.id}|${review.type}|${review.date}`).digest("hex").slice(0, 24);
      out.push(
        "BEGIN:VEVENT",
        `UID:arp-${uid}@${new URL(siteUrl).hostname}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${review.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${nextDay(review.date).replace(/-/g, "")}`,
        "SUMMARY:Research inventory review",
        `DESCRIPTION:${icsText(`${itemName(entry, line)}: ${CHECKPOINTS[review.type] ?? review.type}. An estimated inventory checkpoint, not a dosing or administration reminder.`)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    }
  });
  out.push("END:VCALENDAR");
  return `${out.map(fold).join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------------------------
// Printable page
// ---------------------------------------------------------------------------------------------

const html = (text: unknown) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function printable(plan: Plan, lines: LineEntry[], totals: { estimate: string | null }, origins: string[], now: Date): string {
  const host = new URL(siteUrl).hostname;
  const rows = plan.lines
    .map((line, index) => {
      const entry = lines[index];
      const result = entry?.result as Record<string, unknown> | null;
      const status = entry?.ok ? "" : `<div class="error">${html(entry?.errors.map((e) => e.message).join(" "))}</div>`;
      return `<tr><td><strong>${html(entry ? itemName(entry, line) : "")}</strong>${line.label ? `<div class="label">${html(line.label)}</div>` : ""}</td><td>${html(planText(line))}${line.mode === "schedule" && (line.start_date ?? plan.start_date) ? `<div class="label">From ${html(line.start_date ?? plan.start_date)}</div>` : ""}${status}</td><td class="num">${html(result ? result.quantity : "—")}</td><td class="num">${html(result ? money(result.estimate as string | null) || "No price" : "—")}</td></tr>`;
    })
    .join("");
  const reviews = plan.lines
    .flatMap((line, index) => ((lines[index]?.timeline?.review_events as { date: string; type: string }[] | undefined) ?? []).filter((r) => r.date).map((r) => ({ ...r, name: itemName(lines[index], line) })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const origin = origins.length ? `<p class="meta">Based on the pre-built protocol${origins.length > 1 ? "s" : ""}: ${html(origins.join(", "))}. Written by the store for research use. Check every value before you order. Not medical advice.</p>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${html(plan.title || "Research protocol")} – ${html(business.name)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:${BRAND.accent};margin:32px;line-height:1.45;font-size:14px}
header{border-bottom:3px solid ${BRAND.primary};padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
.brand{font-size:20px;font-weight:700;color:${BRAND.strong};letter-spacing:.02em}
h1{font-size:22px;margin:0 0 4px}.meta{color:#555;margin:4px 0}
table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;vertical-align:top}
th{background:${BRAND.soft};font-weight:600}.num{text-align:right;white-space:nowrap}.label{color:#555;font-size:12px}.error{color:#a00;font-size:12px}
tfoot td{font-weight:700;border-top:2px solid ${BRAND.primary}}h2{font-size:16px;margin:24px 0 8px}ul{padding-left:18px}
.note{background:${BRAND.soft};padding:12px;border-radius:4px;font-size:12px}footer{margin-top:32px;border-top:1px solid #ddd;padding-top:8px;color:#555;font-size:12px}
@media print{body{margin:12mm}}
</style></head><body>
<header><div><div class="brand">${html(business.name)}</div><h1>${html(plan.title || "Research protocol")}</h1><p class="meta">Created ${html(now.toISOString().slice(0, 10))}${plan.start_date ? ` · Protocol start ${html(plan.start_date)}` : ""}</p></div></header>
${origin}
<table><thead><tr><th>Item</th><th>Plan</th><th class="num">Units to buy</th><th class="num">Estimate</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">Estimated total</td><td class="num">${html(money(totals.estimate) || "—")}</td></tr></tfoot></table>
${reviews.length ? `<h2>Research inventory review dates</h2><ul>${reviews.map((r) => `<li>${html(r.date)}: ${html(r.name)}, ${html((CHECKPOINTS[r.type] ?? r.type).toLowerCase())}</li>`).join("")}</ul>` : ""}
${plan.notes ? `<h2>Notes</h2><p>${html(plan.notes).replace(/\n/g, "<br>")}</p>` : ""}
<div class="note"><p>${html(ESTIMATE_NOTE)}</p><p>${html(DISCLAIMER)}</p></div>
<footer>${html(business.name)} · ${html(host)}</footer>
</body></html>
`;
}

/** POST /exports for a JSON body. */
export function exportPlan(body: unknown, products: Map<number, PlannerProduct>, now = new Date()): ExportAnswer {
  const request = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const missing = ["format", "plan"].filter((name) => !(name in request));
  if (missing.length) return { status: 400, body: { code: "rest_missing_callback_param", message: `Missing parameter(s): ${missing.join(", ")}`, data: { status: 400, params: missing } } };
  if (typeof request.format !== "string" || !FORMATS.includes(request.format)) return invalid("format", "format is not one of csv, ics, and print.", "rest_not_in_enum");
  const raw = request.plan;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid("plan", "plan is not of type object.", "rest_invalid_type");
  const document = raw as Record<string, unknown>;
  if (document.schema !== "arp-plan" || document.version !== 1 || !Array.isArray(document.lines)) {
    return { status: 400, body: { code: "arp_invalid_request", message: "The request could not be processed. Please reload the page and try again.", data: { errors: [{ field: "plan", code: "invalid_type", message: "This value has the wrong type or format." }], status: 400 } } };
  }
  const answer = calculatePlan({ lines: document.lines, start_date: document.start_date ?? null }, products, now);
  if (answer.status !== 200) return answer;
  const lines = answer.body.lines as LineEntry[];
  const totals = answer.body.totals as { estimate: string | null };
  const plan: Plan = {
    title: typeof document.title === "string" ? document.title.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, 200) : "",
    start_date: typeof document.start_date === "string" ? document.start_date : null,
    notes: typeof document.notes === "string" ? document.notes.slice(0, 5000) : "",
    lines: document.lines as PlanLine[],
  };
  const date = now.toISOString().slice(0, 10);
  if (request.format === "csv") return { status: 200, file: { content: csv(plan, lines, totals), type: "text/csv; charset=utf-8", filename: `research-protocol-${date}.csv` } };
  if (request.format === "ics") {
    const any = lines.some((line) => ((line.timeline?.review_events as unknown[] | undefined) ?? []).length > 0);
    if (!any) return { status: 400, body: { code: "arp_no_start_date", message: "Add a protocol start date to export review dates.", data: { status: 400 } } };
    return { status: 200, file: { content: ics(plan, lines, now), type: "text/calendar; charset=utf-8", filename: `research-protocol-${date}.ics` } };
  }
  const ids = Array.isArray(request.store_protocols) ? request.store_protocols.filter((id): id is string => typeof id === "string").slice(0, 5) : [];
  const origins = ids.flatMap((id) => plannerStoreProtocols.items.find((item) => item.id === id)?.name ?? []);
  return { status: 200, file: { content: printable(plan, lines, totals, origins, now), type: "text/html; charset=utf-8", filename: `research-protocol-${date}.html` } };
}
