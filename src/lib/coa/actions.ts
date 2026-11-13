"use server";

/**
 * "Request COA verification links" on the lab results page: e-mails the chosen certificates'
 * verification links to the address the visitor types.
 *
 * The e-mail is built here from the page's own certificates (only their ids come from the browser),
 * so the form can't be used to send other text or links. A few requests per address per 10 minutes.
 *
 * Sent through SendGrid (src/lib/email/index.ts), in the shop's design with a plain-text copy. When it can't be
 * sent ("not-sent": no key on the live site, SendGrid refused) the library offers the visitor's own e-mail app
 * and a copy button instead; a test site without a test inbox saves it in .data/mail/.
 */
import { headers } from "next/headers";

import { COA_LINKS_SUBJECT, coaLinksText } from "@/components/coa/links-text";
import { sendEmail } from "@/lib/email";
import { coaLinksHtml } from "@/lib/email/coa-email";
import { siteUrl } from "@/lib/site";

import { getCoas } from "./library";

export type EmailCoaLinksResult = { status: "sent" | "saved-locally" | "not-sent" } | { status: "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CERTIFICATES = 25;
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
/** Recent requests per visitor (IP address), kept in this server's memory. */
const recent = new Map<string, number[]>();

export async function emailCoaLinks(email: string, ids: string[]): Promise<EmailCoaLinksResult> {
  const to = String(email ?? "").trim();
  if (to.length > 254 || !EMAIL.test(to)) return { status: "error", message: "Please enter a valid email address." };
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(String))].slice(0, MAX_CERTIFICATES);
  const coas = (await getCoas()).filter((coa) => wanted.includes(coa.id));
  if (!coas.length) return { status: "error", message: "Please choose at least one certificate." };

  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const visitor = forwarded.split(",")[0].trim() || "local";
  const now = Date.now();
  const times = (recent.get(visitor) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) return { status: "error", message: "Too many requests. Please try again in a few minutes." };
  recent.set(visitor, [...times, now]);

  try {
    const subject = `${COA_LINKS_SUBJECT} (${coas.length})`;
    const libraryUrl = `${siteUrl}/lab-results-certificates-of-analysis/#result`;
    const status = await sendEmail({ to, subject, text: coaLinksText(coas, libraryUrl), html: coaLinksHtml(subject, coas, libraryUrl) });
    return { status };
  } catch (error) {
    // e.g. a server that can't save the local copy (read-only disk): the library offers the fallback.
    console.error("[coa] e-mail not sent:", error);
    return { status: "not-sent" };
  }
}
