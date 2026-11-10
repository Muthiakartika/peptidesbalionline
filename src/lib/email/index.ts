/**
 * Sending the shop's e-mails (server code only).
 *
 *   const result = await sendEmail({ to, subject, text });
 *   // "sent"          handed to the e-mail provider (none chosen yet: Q-08)
 *   // "saved-locally" development: written to .data/mail/ instead (open the .txt file to see it)
 *   // "not-sent"      production without a provider: nothing goes out, and the caller says so
 *
 * Until the owner picks a provider (Q-08) nothing is sent anywhere: on this computer every e-mail is
 * saved as a text file in .data/mail/, so the links in it (set your password, reset your password) can be
 * tried; on a live server the site says the e-mail couldn't be sent instead of pretending.
 */
import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type Email = { to: string; subject: string; text: string };
export type EmailResult = "sent" | "saved-locally" | "not-sent";

export const LOCAL_MAIL_DIR = ".data/mail";

export async function sendEmail(email: Email): Promise<EmailResult> {
  if (process.env.SITE_ENV === "production") {
    console.error(`[email] no e-mail provider yet (Q-08): "${email.subject}" was not sent`);
    return "not-sent";
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = email.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const file = path.join(LOCAL_MAIL_DIR, `${stamp}-${slug}.txt`);
  await mkdir(LOCAL_MAIL_DIR, { recursive: true });
  await writeFile(file, `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`, "utf8");
  console.log(`[email] saved locally (not sent): ${file}`);
  return "saved-locally";
}
