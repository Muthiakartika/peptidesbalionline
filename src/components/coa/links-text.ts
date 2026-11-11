/**
 * The text of the "COA verification links" e-mail: the same text whether the site sends it
 * (src/lib/coa/actions.ts) or, while no e-mail provider is set up, the visitor's own e-mail app opens
 * with it (CoaLibrary.tsx). Plain text, one block per certificate.
 */
import type { Coa } from "./types";

export const COA_LINKS_SUBJECT = "Atlas Longevity: COA verification links";

export function coaLinksText(coas: Coa[], libraryUrl: string): string {
  const blocks = coas.map((c) =>
    [
      `${c.title} (${c.peptide}) · purity ${c.purityText} · ${c.lab} · tested ${c.testedLabel}`,
      c.verifyUrl ? `Verify on ${c.lab}: ${c.verifyUrl}` : null,
      c.reportUrl && c.reportUrl !== c.verifyUrl ? `Report: ${c.reportUrl}` : null,
      c.verificationKey ? `Verification key: ${c.verificationKey}` : null,
      c.searchCode ? `Search code: ${c.searchCode}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    "Here are the verification links you requested from the Atlas Longevity COA library.",
    "Each link opens the certificate from the laboratory that issued it, so you can check it directly.",
    "",
    blocks.join("\n\n"),
    "",
    `COA library: ${libraryUrl}`,
    "",
    "For laboratory research use only.",
  ].join("\n");
}
