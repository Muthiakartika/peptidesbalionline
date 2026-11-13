/**
 * Sending the shop's e-mails (server code only), through SendGrid (Q-08: chosen 13 Nov 2026).
 *
 *   const result = await sendEmail({ to, subject, text });
 *   // "sent"          handed to SendGrid
 *   // "saved-locally" not sent: written to .data/mail/ instead (open the .txt file to see it)
 *   // "not-sent"      nothing went out (no key on the live site, or SendGrid refused it), and the caller says so
 *
 * Settings (in .env.local and on Vercel; how to get them: docs/setup/email.md):
 *   SENDGRID_API_KEY  SendGrid's API key (permission "Mail Send"). Without it nothing is sent.
 *   EMAIL_FROM        the sender. Default "Peptides Bali <hello@peptidesbali.online>", as live (WP Mail SMTP).
 *                     Its domain must be verified in SendGrid, or SendGrid refuses the e-mail.
 *   EMAIL_TEST_TO     only read while SITE_ENV isn't "production": every e-mail goes to this one inbox instead.
 *
 * Why the test inbox: this computer and the Vercel test site work on the real customers' data (Neon), so a
 * test there (changing an imported order's status, a password reset) must never e-mail a real customer.
 * A test site without EMAIL_TEST_TO keeps saving the e-mails in .data/mail/ (or, where it can't write
 * files, as on Vercel, sends nothing). Only SITE_ENV=production sends to the real address.
 */
import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { business, siteUrl } from "@/lib/site";

import { testBanner } from "./html";

/** `text` always (the plain copy every e-mail carries), `html` for the designed version (src/lib/email/html.ts). */
export type Email = { to: string; subject: string; text: string; html?: string };
export type EmailResult = "sent" | "saved-locally" | "not-sent";
export type Address = { email: string; name?: string };

export const LOCAL_MAIL_DIR = ".data/mail";
export const DEFAULT_FROM = `Peptides Bali <${business.email}>`;
const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

/** "Name <address>" or a bare address → { email, name }; null when it isn't one address. */
export function parseAddress(value: string | undefined): Address | null {
  const match = (value ?? "").trim().match(/^(?:"?([^"<>]*?)"?\s*<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>|([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+))$/);
  if (!match) return null;
  const email = match[2] ?? match[3];
  const name = match[1]?.trim();
  return name ? { email, name } : { email };
}

export type DeliveryPlan =
  | { kind: "sendgrid"; key: string; from: Address; to: string; subject: string; text: string; html?: string }
  | { kind: "local" }
  | { kind: "none"; reason: string };

/** What happens to an e-mail with these settings (no side effects, so the rules can be tested). */
export function planDelivery(email: Email, env: Record<string, string | undefined> = process.env): DeliveryPlan {
  const production = env.SITE_ENV === "production";
  const key = env.SENDGRID_API_KEY?.trim();
  if (!key) return production ? { kind: "none", reason: "SENDGRID_API_KEY isn't set" } : { kind: "local" };
  const from = parseAddress(env.EMAIL_FROM?.trim() || DEFAULT_FROM);
  if (!from) return { kind: "none", reason: "EMAIL_FROM isn't an e-mail address" };
  if (production) return { kind: "sendgrid", key, from, to: email.to, subject: email.subject, text: email.text, ...(email.html ? { html: email.html } : {}) };
  const testInbox = parseAddress(env.EMAIL_TEST_TO);
  if (!testInbox) return { kind: "local" };
  const site = env.NEXT_PUBLIC_SITE_URL ?? siteUrl;
  return {
    kind: "sendgrid",
    key,
    from,
    to: testInbox.email,
    subject: `[Test] ${email.subject}`,
    text: `Test e-mail from ${site}. On the live site it goes to ${email.to}.\n\n${email.text}`,
    ...(email.html ? { html: testBanner(email.html, email.to, site) } : {}),
  };
}

/** SendGrid's v3 "mail/send" request. Link tracking off: the set-password and order links must reach the customer as they are. */
export function sendGridRequest(plan: Extract<DeliveryPlan, { kind: "sendgrid" }>) {
  return {
    personalizations: [{ to: [{ email: plan.to }] }],
    from: plan.from,
    subject: plan.subject,
    // SendGrid wants text/plain first; e-mail apps show the HTML and fall back to the text.
    content: [{ type: "text/plain", value: plan.text }, ...(plan.html ? [{ type: "text/html", value: plan.html }] : [])],
    tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
  };
}

export async function sendEmail(email: Email): Promise<EmailResult> {
  const plan = planDelivery(email);
  if (plan.kind === "none") {
    console.error(`[email] "${email.subject}" was not sent: ${plan.reason} (docs/setup/email.md)`);
    return "not-sent";
  }
  if (plan.kind === "local") return saveLocally(email);
  try {
    const response = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${plan.key}`, "content-type": "application/json" },
      body: JSON.stringify(sendGridRequest(plan)),
      signal: AbortSignal.timeout(10_000),
    });
    // SendGrid answers 202 Accepted: it will deliver the e-mail. (The log names the subject only, never an address.)
    if (response.ok) {
      console.info(`[email] handed to SendGrid${plan.subject.startsWith("[Test]") ? " (test inbox)" : ""}: "${email.subject}"`);
      return "sent";
    }
    const detail = await response.text().catch(() => "");
    console.error(`[email] SendGrid refused "${email.subject}" (HTTP ${response.status}): ${detail.slice(0, 300)}`);
  } catch (error) {
    console.error(`[email] SendGrid couldn't be reached for "${email.subject}": ${error instanceof Error ? error.message : String(error)}`);
  }
  return "not-sent";
}

/** A test site without a test inbox: the e-mail becomes a text file, so its links can be tried. */
async function saveLocally(email: Email): Promise<EmailResult> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = email.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const file = path.join(LOCAL_MAIL_DIR, `${stamp}-${slug}.txt`);
    await mkdir(LOCAL_MAIL_DIR, { recursive: true });
    await writeFile(file, `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`, "utf8");
    // The designed version next to it: open the .html file in a browser to see the e-mail.
    if (email.html) await writeFile(file.replace(/\.txt$/, ".html"), email.html, "utf8");
    console.log(`[email] saved locally (not sent): ${file}`);
    return "saved-locally";
  } catch (error) {
    // A server that can't write files (Vercel): nothing is sent, and the caller says so.
    console.error(`[email] "${email.subject}" was not sent (no SendGrid key) and couldn't be saved: ${error instanceof Error ? error.message : String(error)}`);
    return "not-sent";
  }
}
