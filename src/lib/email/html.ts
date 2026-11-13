/**
 * The shop's e-mail design (HTML), in the site's own look: the gold logo on a warm-black band, a white card on
 * a cream page, Anton headings (Impact where an e-mail app can't load web fonts, as Gmail), Inter text, gold
 * pill buttons. Every e-mail is sent with a plain-text copy too (src/lib/email/index.ts).
 *
 * E-mail apps only understand old-fashioned HTML: tables for layout, styles written on each element, no
 * scripts, pictures from a public address. Every value that comes from a customer or the catalogue is escaped
 * here (esc), so a name or a note can never add markup to an e-mail.
 */
import { mediaUrl } from "@/lib/media/url";
import { business, siteUrl } from "@/lib/site";

export const COLOR = {
  page: "#f4efe3",
  card: "#ffffff",
  ink: "#111111",
  band: "#0d0d0d",
  text: "#4a4a4a",
  muted: "#8a8a8a",
  gold: "#b8952a",
  goldStrong: "#8a6d16",
  goldLight: "#d1b157",
  goldSoft: "#f8f3e6",
  line: "#ece4d0",
};

export const FONT = {
  display: "'Anton', Impact, 'Arial Narrow Bold', 'Helvetica Neue', Arial, sans-serif",
  body: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

/** The logo as live serves it (WordPress upload → the R2 bucket once NEXT_PUBLIC_MEDIA_BASE_URL is set): an e-mail needs a public picture. */
export const LOGO_URL = mediaUrl("https://peptidesbali.online/wp-content/uploads/2026/08/WhatsApp_Image_2026-08-07_at_4.13.04_PM-removebg-preview.png");

export const whatsappLink = (message?: string) => `https://wa.me/${business.whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/** Text → safe HTML. */
export function esc(value: string | number | bigint | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Text with its line breaks kept. */
export const escLines = (value: string) => esc(value).replace(/\r?\n/g, "<br>");

/** An address on this site or a full https address (never javascript: or the like). */
export function href(url: string): string {
  if (url.startsWith("/")) return esc(`${siteUrl}${url}`);
  return /^(https?:|mailto:)/i.test(url) ? esc(url) : "#";
}

const P_STYLE = `margin:0 0 16px;font-family:${FONT.body};font-size:15px;line-height:1.6;color:${COLOR.text};`;

/** A paragraph of text (escaped). */
export const paragraph = (text: string) => `<p style="${P_STYLE}">${escLines(text)}</p>`;

/** A paragraph that already is HTML (only for markup built here). */
export const paragraphHtml = (html: string) => `<p style="${P_STYLE}">${html}</p>`;

/** A pill button; Outlook gets a square one. */
export function button(label: string, url: string, tone: "gold" | "dark" = "gold"): string {
  const background = tone === "gold" ? COLOR.gold : COLOR.ink;
  const color = tone === "gold" ? COLOR.ink : "#ffffff";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:${background};">
<a href="${href(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT.body};font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color};text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

/** The address behind a button, written out for e-mail apps that block buttons. */
export function fallbackLink(url: string, before = "Button not working? Copy this address into your browser:"): string {
  return `<p style="margin:0 0 20px;font-family:${FONT.body};font-size:12px;line-height:1.6;color:${COLOR.muted};word-break:break-all;">${esc(before)}<br><a href="${href(url)}" target="_blank" style="color:${COLOR.goldStrong};">${esc(url.startsWith("/") ? `${siteUrl}${url}` : url)}</a></p>`;
}

/** A small gold label above a section, with an optional value on the right. */
export function sectionTitle(label: string, right = ""): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;"><tr>
<td style="font-family:${FONT.body};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLOR.goldStrong};">${esc(label)}</td>
<td align="right" style="font-family:${FONT.body};font-size:12px;color:${COLOR.muted};">${esc(right)}</td>
</tr></table>`;
}

/** A soft box with a gold edge: label / value lines (values escaped; a link when given one). */
export function infoBox(title: string, rows: { label: string; value: string; link?: string }[]): string {
  if (!rows.length) return "";
  const lines = rows
    .map(
      (row) => `<tr><td style="padding:3px 0;font-family:${FONT.body};font-size:13px;line-height:1.5;color:${COLOR.muted};width:84px;padding-right:10px;vertical-align:top;">${esc(row.label)}</td>
<td style="padding:3px 0;font-family:${FONT.body};font-size:14px;line-height:1.5;color:${COLOR.ink};vertical-align:top;">${row.link ? `<a href="${href(row.link)}" target="_blank" style="color:${COLOR.goldStrong};text-decoration:underline;">${escLines(row.value)}</a>` : escLines(row.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:${COLOR.goldSoft};border-left:3px solid ${COLOR.gold};border-radius:6px;"><tr><td style="padding:16px 18px;">
<div style="margin:0 0 8px;font-family:${FONT.body};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLOR.goldStrong};">${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table>
</td></tr></table>`;
}

/** A quoted note (a customer's delivery note, the shop's note to the customer). */
export function noteBox(title: string, text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid ${COLOR.line};border-radius:8px;"><tr><td style="padding:16px 18px;">
<div style="margin:0 0 6px;font-family:${FONT.body};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLOR.goldStrong};">${esc(title)}</div>
<div style="font-family:${FONT.body};font-size:15px;line-height:1.6;color:${COLOR.ink};">${escLines(text)}</div>
</td></tr></table>`;
}

/** The order's progress: Received → Processing → On its way, the current step in gold. */
export function tracker(step: 1 | 2 | 3): string {
  const steps = ["Received", "Processing", "On its way"];
  const cells = steps
    .map((label, index) => {
      const reached = index < step;
      return `<td width="33%" style="padding:0 3px;vertical-align:top;">
<div style="height:4px;line-height:4px;font-size:0;border-radius:4px;background:${reached ? COLOR.gold : COLOR.line};">&nbsp;</div>
<div style="padding-top:8px;font-family:${FONT.body};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${reached ? COLOR.ink : COLOR.muted};">${esc(label)}</div>
</td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;"><tr>${cells}</tr></table>`;
}

/** Two columns side by side that stack on a phone (no media query needed). */
export function twoColumns(left: string, right: string): string {
  const column = (content: string) =>
    `<div class="col" style="display:inline-block;width:100%;max-width:262px;vertical-align:top;margin:0 0 16px;">${content}</div>`;
  // font-size:0 stops the gap between the two inline blocks; Outlook for Windows simply stacks them.
  return `<div style="font-size:0;margin:0 0 8px;">${column(left)}${right ? `<div style="display:inline-block;width:12px;"></div>${column(right)}` : ""}</div>`;
}

/** An address block: a small title and its lines. */
export function addressBlock(title: string, lines: string[]): string {
  if (!lines.length) return "";
  return `<div style="font-family:${FONT.body};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLOR.goldStrong};margin:0 0 6px;">${esc(title)}</div>
<div style="font-family:${FONT.body};font-size:14px;line-height:1.6;color:${COLOR.text};">${lines.map(esc).join("<br>")}</div>`;
}

/** The help line every customer e-mail ends with: WhatsApp and the shop's e-mail. */
export function helpBlock(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;border-top:1px solid ${COLOR.line};"><tr><td style="padding:20px 0 0;font-family:${FONT.body};font-size:14px;line-height:1.6;color:${COLOR.text};">
Need any help? Message us on <a href="${href(whatsappLink())}" target="_blank" style="color:${COLOR.goldStrong};font-weight:700;text-decoration:none;">WhatsApp</a>
or write to <a href="mailto:${esc(business.email)}" style="color:${COLOR.goldStrong};font-weight:700;text-decoration:none;">${esc(business.email)}</a>.
</td></tr></table>`;
}

export type Layout = {
  /** The e-mail's title (the subject). */
  title: string;
  /** The grey line an inbox shows after the subject. */
  preheader: string;
  /** The small gold label above the heading, e.g. "Order #12900". */
  eyebrow?: string;
  heading: string;
  /** The card's content, already HTML (built with the helpers above). */
  body: string;
  /** Why this person gets the e-mail (footer). */
  reason?: string;
};

/** The whole e-mail: page, logo band, card, footer. */
export function layout({ title, preheader, eyebrow, heading, body, reason }: Layout): string {
  const year = new Date().getUTCFullYear();
  const link = (label: string, path: string) => `<a href="${href(path)}" target="_blank" style="color:${COLOR.goldLight};text-decoration:none;">${esc(label)}</a>`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&amp;family=Inter:wght@400;600;700&amp;display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; background:${COLOR.page}; }
  a { color:${COLOR.goldStrong}; }
  @media (max-width: 620px) {
    .card { padding: 28px 22px !important; }
    .band { padding: 22px !important; }
    .heading { font-size: 28px !important; }
    .col { max-width: 100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.page};"><tr><td align="center" style="padding:24px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td class="band" align="center" style="background:${COLOR.band};padding:26px 32px;border-radius:14px 14px 0 0;border-bottom:3px solid ${COLOR.gold};">
<a href="${href("/")}" target="_blank"><img src="${esc(LOGO_URL)}" width="150" alt="Atlas Longevity" style="display:block;width:150px;max-width:150px;height:auto;border:0;"></a>
</td></tr>
<tr><td class="card" style="background:${COLOR.card};padding:36px 32px 32px;border-radius:0 0 14px 14px;">
${eyebrow ? `<div style="margin:0 0 10px;font-family:${FONT.body};font-size:12px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${COLOR.gold};">${esc(eyebrow)}</div>` : ""}
<h1 class="heading" style="margin:0 0 20px;font-family:${FONT.display};font-size:34px;line-height:1.1;font-weight:400;letter-spacing:0.5px;text-transform:uppercase;color:${COLOR.ink};">${esc(heading)}</h1>
${body}
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-family:${FONT.body};font-size:12px;line-height:1.7;color:${COLOR.muted};">
<div style="background:${COLOR.band};border-radius:999px;display:inline-block;padding:8px 18px;margin:0 0 14px;">${link("Shop", "/shop/")} &nbsp;·&nbsp; ${link("Lab results", "/lab-results-certificates-of-analysis/")} &nbsp;·&nbsp; ${link("My account", "/my-account/")}</div>
<div>Atlas Longevity · Bali, Indonesia · <a href="mailto:${esc(business.email)}" style="color:${COLOR.muted};">${esc(business.email)}</a></div>
<div>For lawful research use only. Not intended for human or animal consumption.</div>
${reason ? `<div style="margin-top:6px;">${esc(reason)}</div>` : ""}
<div style="margin-top:6px;">© ${year} Atlas Longevity</div>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

/** The banner a test site puts on top of every e-mail (src/lib/email/index.ts). */
export function testBanner(html: string, realRecipient: string, site: string): string {
  const banner = `<div style="background:#fff4c2;border-bottom:1px solid #e9d27a;padding:10px 16px;text-align:center;font-family:${FONT.body};font-size:13px;color:#5c4a00;">Test e-mail from ${esc(site)}. On the live site it goes to <strong>${esc(realRecipient)}</strong>.</div>`;
  return html.replace(/<body([^>]*)>/i, (tag) => `${tag}\n${banner}`);
}
