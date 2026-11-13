/**
 * Which certificates of analysis a product page shows (the owner, 13 Nov 2026: "all products we have
 * certificates for … on the actual product page for Vials, Pens and nasal sprays").
 *
 * The COA cards on the lab results page each link to one product, nearly always the vial
 * (src/lib/coa/library.ts → productPath). A product shows:
 *   1. the certificates that link to it ("own"), or else
 *   2. the certificates of the vial with the same compound, when the product is a single compound in
 *      another format: "BPC-157 Pen" and "BPC-157 Nasal Spray" show the BPC-157 vial's report ("vial":
 *      the page says the sample was the vial). A mix ("TB-500 + BPC-157 Pen", "Semax + Selank") and a
 *      blend certificate ("BPC-157/TB-500 blend") are never matched this way, nor bundles, protocols,
 *      supplies and other non-peptide products.
 */
import type { Coa } from "@/components/coa/types";

export type ProductCoas = { coas: Coa[]; sampled: "own" | "vial" };

type NamedProduct = { path: string; name: string; categories?: string[] };

/** Categories whose products never borrow a vial's certificate. */
const NO_BORROWING = new Set(["bundles", "peptide-protocols", "recovery-stacks", "longevity-wellness-stacks", "supplies", "other"]);

/** Words that say nothing about the compound: the format, the brand, the place. */
const NOISE = /\b(?:pens?|peptides?|nasal|spray|bali|atlas|longevity|injection|blend|vials?|disposable|reusable|pre-?filled|kit)\b/g;

/**
 * The compound a product's name stands for, as a comparable key ("BPC-157 Pen" → "bpc157",
 * "CJC 1295 – Without DAC" → "cjc1295nodac", "GLP-3 RTA" → "glp3rta"), or null for a mix of
 * compounds ("GHK-Cu + KPV 60mg Peptide Pen", "BPC-157 5MG & TB-500 5MG").
 */
export function compoundKey(name: string): string | null {
  let s = name.toLowerCase().replace(/[‐‑‒–—]/g, "-");
  s = s.split(" | ")[0];
  // An ingredient list in brackets ("(GHK-Cu + KPV + …)") or a "(Copy)" goes; other brackets open up ("( NO DAC )").
  s = s.replace(/\(([^)]*)\)/g, (_, inside: string) => (/\+|copy/.test(inside) ? " " : ` ${inside} `));
  // " – " parts: an ingredient list after the name goes ("KLOW Blend 80mg – BPC-157 10 mg + …").
  s = s
    .split(/\s-\s/)
    .filter((part) => !/\s\+/.test(part))
    .join(" ");
  if (/\s\+|\s&\s/.test(s)) return null;
  s = s
    .replace(/\bwithout\b/g, "no")
    .replace(/\b\d+(?:[.,]\d+)*\s*(?:mg|mcg|iu|ml|g)\b/g, " ")
    .replace(NOISE, " ")
    .replace(/[^a-z0-9]+/g, "");
  return s || null;
}

/** A certificate of a blend ("BPC-15710MG/TB-50010MG 20MG blend"): only ever shown on its own product. */
const isBlendCertificate = (coa: Coa) => /\/|\bblend\b/i.test(coa.title);

const newestFirst = (a: Coa, b: Coa) => b.testedOn.localeCompare(a.testedOn) || b.purity - a.purity;

export function coasForProduct(product: NamedProduct, coas: Coa[], products: NamedProduct[]): ProductCoas {
  const own = coas.filter((coa) => coa.productPath === product.path);
  if (own.length > 0) return { coas: own.sort(newestFirst), sampled: "own" };
  if (product.categories?.some((slug) => NO_BORROWING.has(slug))) return { coas: [], sampled: "own" };
  const key = compoundKey(product.name);
  if (!key) return { coas: [], sampled: "own" };
  const byPath = new Map(products.map((p) => [p.path, p]));
  const borrowed = coas.filter((coa) => {
    if (!coa.productPath || isBlendCertificate(coa)) return false;
    const vial = byPath.get(coa.productPath);
    return vial !== undefined && compoundKey(vial.name) === key;
  });
  return { coas: borrowed.sort(newestFirst), sampled: borrowed.length ? "vial" : "own" };
}
