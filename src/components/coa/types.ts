/**
 * One certificate of analysis in the COA library on /lab-results-certificates-of-analysis/. Plain
 * values only: the list is handed to the browser part of the page (CoaLibrary.tsx). Built on the
 * server from the page's own COA cards by src/lib/coa/library.ts, so the cards stay editable where
 * the page is edited (Sanity).
 */
export type Coa = {
  /** Stable id for links and selection, e.g. "janoshik-215021" or "freedom-diagnostics-2609100647". */
  id: string;
  /** The compound, e.g. "Retatrutide" (the filter groups by it). */
  peptide: string;
  /** The tested sample as the card names it, e.g. "Retatrutide 10mg". */
  title: string;
  /** e.g. "10 mg" (empty when the card has none). */
  amount: string;
  /** e.g. 99.301 */
  purity: number;
  /** As printed, e.g. "99.301%". */
  purityText: string;
  /** "2026-08-20" (for sorting and filtering). */
  testedOn: string;
  /** "20 Aug 2026" as printed. */
  testedLabel: string;
  /** "Janoshik" or "Freedom Diagnostics". */
  lab: string;
  /** The batch or client reference on the report, e.g. "SUL0330-001". */
  batch: string | null;
  /** Janoshik task number and verification key. */
  task: string | null;
  verificationKey: string | null;
  /** Freedom Diagnostics search code (typed on their site to find the report) and accession number. */
  searchCode: string | null;
  accession: string | null;
  verifyUrl: string | null;
  reportUrl: string | null;
  /** The report is a PDF file we host (can be shown in the preview); otherwise the lab's own page. */
  reportIsPdf: boolean;
  productPath: string | null;
};

export type CoaLibraryIntro = { eyebrow: string; title: string; text: string };

export type CoaLibraryProps = { coas: Coa[]; intro: CoaLibraryIntro };
