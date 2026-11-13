/**
 * The "COA verification links" e-mail in the shop's design (the plain text is src/components/coa/links-text.ts,
 * which the visitor's own e-mail app also uses when the site can't send). One card per certificate.
 */
import type { Coa } from "@/components/coa/types";

import { button, COLOR, esc, FONT, helpBlock, href, layout, paragraph } from "./html";

function certificate(c: Coa): string {
  const facts = [c.peptide, c.purityText ? `purity ${c.purityText}` : "", c.lab, c.testedLabel ? `tested ${c.testedLabel}` : ""].filter(Boolean).join(" · ");
  const link = (label: string, url: string) => `<a href="${href(url)}" target="_blank" style="color:${COLOR.goldStrong};font-weight:700;text-decoration:underline;">${esc(label)}</a>`;
  const links = [c.verifyUrl ? link(`Verify on ${c.lab}`, c.verifyUrl) : "", c.reportUrl && c.reportUrl !== c.verifyUrl ? link("Report", c.reportUrl) : ""].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const codes = [c.verificationKey ? `Verification key: ${c.verificationKey}` : "", c.searchCode ? `Search code: ${c.searchCode}` : ""].filter(Boolean);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border:1px solid ${COLOR.line};border-radius:10px;"><tr><td style="padding:16px 18px;font-family:${FONT.body};">
<div style="font-size:15px;font-weight:700;color:${COLOR.ink};">${esc(c.title)}</div>
<div style="margin:2px 0 8px;font-size:12px;line-height:1.5;color:${COLOR.muted};">${esc(facts)}</div>
${links ? `<div style="font-size:14px;line-height:1.6;">${links}</div>` : ""}
${codes.map((code) => `<div style="font-size:12px;line-height:1.6;color:${COLOR.text};">${esc(code)}</div>`).join("")}
</td></tr></table>`;
}

export function coaLinksHtml(subject: string, coas: Coa[], libraryUrl: string): string {
  return layout({
    title: subject,
    preheader: `${coas.length} certificate${coas.length === 1 ? "" : "s"}, each checkable at the laboratory that issued it.`,
    eyebrow: "Lab results",
    heading: "Your COA verification links",
    body: [
      paragraph("Here are the verification links you requested from the Atlas Longevity COA library."),
      paragraph("Each link opens the certificate from the laboratory that issued it, so you can check it directly."),
      ...coas.map(certificate),
      `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>`,
      button("Open the COA library", libraryUrl),
      helpBlock(),
    ].join("\n"),
    reason: "You’re receiving this e-mail because these links were requested on our lab results page.",
  });
}
