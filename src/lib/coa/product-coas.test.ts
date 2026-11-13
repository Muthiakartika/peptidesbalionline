/**
 * Certificates on product pages (src/lib/coa/product-coas.ts): a vial shows its own, a pen or nasal
 * spray of the same single compound borrows the vial's, mixes and blends never borrow.
 */
import { describe, expect, it } from "vitest";

import type { Coa } from "@/components/coa/types";

import { coasForProduct, compoundKey } from "./product-coas";

const coa = (id: string, title: string, productPath: string, testedOn = "2026-08-01"): Coa =>
  ({ id, title, productPath, testedOn, purity: 99.5, peptide: title.split(" ")[0], amount: "", purityText: "99.5%", testedLabel: "", lab: "Janoshik", method: "HPLC", batch: null, task: null, verificationKey: null, searchCode: null, accession: null, verifyUrl: null, reportUrl: null, reportIsPdf: false }) as Coa;

const products = [
  { path: "/product/bpc-157/", name: "BPC-157" },
  { path: "/product/bpc157-5mg-pen/", name: "BPC-157  Pen" },
  { path: "/product/glp-3-5mg/", name: "GLP-3 RTA" },
  { path: "/product/glp-3-10mg-pen/", name: "GLP-3 RTA Pen" },
  { path: "/product/glp-3-10mg-cagrilintide-pen/", name: "GLP-3 RTA 10mg + Cagrilintide 2mg Pen" },
  { path: "/product/cjc-1295-no-dac-vial/", name: "CJC 1295 – Without DAC" },
  { path: "/product/cjc-1295-no-dac/", name: "CJC-1295 ( NO DAC )" },
  { path: "/product/cjc-1295-dac-5mg/", name: "CJC-1295 with DAC" },
  { path: "/product/melanotan-ii/", name: "Melanotan II 10mg" },
  { path: "/product/melatonan-10mg-pen/", name: "Melanotan I 10mg Pen" },
  { path: "/product/melanotan-ii-nasal-spray-10mg/", name: "Melanotan II Nasal Spray 10mg" },
  { path: "/product/klow-blend-80mg/", name: "KLOW Blend 80mg – BPC‑157 10 mg + GHK‑Cu 50 mg + TB‑500 10 mg + KPV 10 mg blend" },
  { path: "/product/klow-pen/", name: "KLOW 80mg Pen (GHK-Cu + KPV + BPC-157 + TB-500)" },
  { path: "/product/nad-500mg/", name: "NAD+" },
  { path: "/product/nad-nasal-spray-500mg/", name: "NAD+ Nasal Spray 500mg" },
  { path: "/product/tb500-bpc157-pen/", name: "Wolverine Blend – TB-500 + BPC-157  Pen" },
  { path: "/product/bpc-recovery-bundle/", name: "BPC-157 Recovery Bundle", categories: ["bundles"] },
];

const coas = [
  coa("j-1", "BPC-157 10mg", "/product/bpc-157/", "2026-04-21"),
  coa("j-2", "BPC-15710MG/TB-50010MG 20MG blend", "/product/bpc-157/", "2026-08-21"),
  coa("j-3", "Retatrutide 10mg", "/product/glp-3-5mg/", "2026-08-20"),
  coa("j-4", "Retatrutide 30mg", "/product/glp-3-5mg/", "2026-09-01"),
  coa("j-5", "CJC-1295 no DAC 5mg", "/product/cjc-1295-no-dac-vial/"),
  coa("j-6", "Melanotan 2 10mg", "/product/melanotan-ii/"),
  coa("j-7", "Klow 80mg", "/product/klow-blend-80mg/"),
  coa("j-8", "NAD+ 1000mg", "/product/nad-500mg/"),
];

const ids = (path: string) => {
  const product = products.find((p) => p.path === path)!;
  const result = coasForProduct(product, coas, products);
  return { ids: result.coas.map((c) => c.id), sampled: result.sampled };
};

describe("compoundKey", () => {
  it("reduces a name to its compound", () => {
    expect(compoundKey("BPC-157  Pen")).toBe("bpc157");
    expect(compoundKey("GLP-1 SMA 10mg Peptide Pen – Atlas Longevity")).toBe("glp1sma");
    expect(compoundKey("CJC 1295 – Without DAC")).toBe(compoundKey("CJC-1295 ( NO DAC )"));
    expect(compoundKey("CJC-1295 with DAC")).not.toBe(compoundKey("CJC-1295 ( NO DAC )"));
    expect(compoundKey("Melanotan I 10mg Pen")).not.toBe(compoundKey("Melanotan II 10mg"));
    expect(compoundKey("NAD+ Nasal Spray 500mg")).toBe("nad");
  });

  it("gives no key to a mix of compounds", () => {
    expect(compoundKey("GHK-Cu + KPV 60mg Peptide Pen Bali | Atlas")).toBeNull();
    expect(compoundKey("Wolverine Stack Blend – BPC-157 5MG & TB-500 5MG")).not.toBe("bpc157");
    expect(compoundKey("Semax + Selank Nasal Spray 10mg Bali | Atlas")).toBeNull();
  });
});

describe("coasForProduct", () => {
  it("shows a vial's own certificates, newest first, blends included", () => {
    expect(ids("/product/bpc-157/")).toEqual({ ids: ["j-2", "j-1"], sampled: "own" });
    expect(ids("/product/glp-3-5mg/")).toEqual({ ids: ["j-4", "j-3"], sampled: "own" });
  });

  it("lends the vial's certificates to a pen or nasal spray of the same compound, never a blend's", () => {
    expect(ids("/product/bpc157-5mg-pen/")).toEqual({ ids: ["j-1"], sampled: "vial" });
    expect(ids("/product/glp-3-10mg-pen/")).toEqual({ ids: ["j-4", "j-3"], sampled: "vial" });
    expect(ids("/product/cjc-1295-no-dac/")).toEqual({ ids: ["j-5"], sampled: "vial" });
    expect(ids("/product/melanotan-ii-nasal-spray-10mg/")).toEqual({ ids: ["j-6"], sampled: "vial" });
    expect(ids("/product/klow-pen/")).toEqual({ ids: ["j-7"], sampled: "vial" });
    expect(ids("/product/nad-nasal-spray-500mg/")).toEqual({ ids: ["j-8"], sampled: "vial" });
  });

  it("lends nothing to mixes, other compounds and bundles", () => {
    expect(ids("/product/glp-3-10mg-cagrilintide-pen/").ids).toEqual([]);
    expect(ids("/product/tb500-bpc157-pen/").ids).toEqual([]);
    expect(ids("/product/melatonan-10mg-pen/").ids).toEqual([]);
    expect(ids("/product/cjc-1295-dac-5mg/").ids).toEqual([]);
    expect(ids("/product/bpc-recovery-bundle/").ids).toEqual([]);
  });
});
