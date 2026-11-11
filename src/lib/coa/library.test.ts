/**
 * The COA library reads the lab results page's own COA cards (src/lib/coa/library.ts): every card
 * becomes one certificate with its lab, codes and links, and the page's separate search section is
 * folded into the library.
 */
import { describe, expect, it } from "vitest";

import type { CoaLibraryProps } from "@/components/coa/types";
import { getElementorPage } from "@/lib/elementor/pages";

import { withCoaLibrary } from "./library";

const page = (await getElementorPage("lab-results-certificates-of-analysis"))!;
const out = withCoaLibrary(page);
const attr = /data-island="coa-library"[^>]*data-island-props="([^"]*)"|data-island-props="([^"]*)"[^>]*data-island="coa-library"/.exec(out.html);
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const props = JSON.parse(decode(attr?.[1] ?? attr?.[2] ?? "{}")) as CoaLibraryProps;

describe("COA library", () => {
  it("turns every COA card into a certificate", () => {
    expect(props.coas).toHaveLength(23);
    for (const coa of props.coas) {
      expect(coa.purity).toBeGreaterThan(90);
      expect(coa.testedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["Janoshik", "Freedom Diagnostics"]).toContain(coa.lab);
      expect(coa.reportUrl).toBeTruthy();
    }
    expect(new Set(props.coas.map((c) => c.id)).size).toBe(props.coas.length);
  });

  it("reads each lab's codes and links", () => {
    const glutathione = props.coas.find((c) => c.title === "Glutathione 1500mg")!;
    expect(glutathione).toMatchObject({ lab: "Freedom Diagnostics", searchCode: "Atla2609100652", accession: "2609100652", reportIsPdf: true, testedOn: "2026-09-11", purityText: "99.91%" });
    expect(glutathione.reportUrl).toMatch(/Atla2609100652\.pdf$/);
    // "Verify" opens the lab's own copy (their lookup page would make the visitor type the code).
    expect(glutathione.verifyUrl).toBe("https://coas.freedomdiagnosticstesting.com/Atla2609100652.pdf");
    const pt141 = props.coas.find((c) => c.title === "PT-141 10mg")!;
    expect(pt141).toMatchObject({ lab: "Janoshik", task: "150804", verificationKey: "TVWLBRAXZ2KR", batch: "SUL0330-001", reportIsPdf: false, productPath: "/product/pt-141/" });
    expect(pt141.verifyUrl).toBe("https://verify.janoshik.com/tests/150804-PT141_10mg_TVWLBRAXZ2KR");
  });

  it("links each Janoshik report to its own test (live had Retatrutide 30mg pointing at Tirzepatide's)", () => {
    const reta = props.coas.find((c) => c.title === "Retatrutide 30mg")!;
    expect(reta.reportUrl).toContain("105536-retatrutide");
    expect(reta.reportUrl).toBe(reta.verifyUrl);
  });

  it("replaces the cards and the old search section, keeping the page's anchor", () => {
    expect(out.html).toMatch(/<section[^>]*id="result"[^>]*data-island="coa-library"/);
    expect(out.html).not.toContain("e-search-form");
    expect(props.intro).toMatchObject({ eyebrow: "Browse Lab Results", title: "Find Your Product" });
    // The rest of the page is kept.
    expect(out.html).toContain("What Information Does a Certificate of Analysis Include?");
  });
});
