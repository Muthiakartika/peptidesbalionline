"use server";

/**
 * "Request COA verification links" on the lab results page: e-mails the chosen certificates'
 * verification links to the address the visitor types.
 *
 * The e-mail is built here from the page's own certificates (only their ids come from the browser),
 * so the form can't be used to send other text or links. A few requests per address per 10 minutes.
 *
 * Until the owner picks an e-mail provider (Q-08) nothing is sent from a live server (sendEmail answers
 * "not-sent"); the library then offers the visitor's own e-mail app and a copy button instead. On this
 * computer the e-mail is saved in .data/mail/.
 */
import { headers } from "next/headers";

import { COA_LINKS_SUBJECT, coaLinksText } from "@/components/coa/links-text";
import { sendEmail } from "@/lib/email";
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
    const status = await sendEmail({
      to,
      subject: `${COA_LINKS_SUBJECT} (${coas.length})`,
      text: coaLinksText(coas, `${siteUrl}/lab-results-certificates-of-analysis/#result`),
    });
    return { status };
  } catch (error) {
    // e.g. a server that can't save the local copy (read-only disk): the library offers the fallback.
    console.error("[coa] e-mail not sent:", error);
    return { status: "not-sent" };
  }
}
