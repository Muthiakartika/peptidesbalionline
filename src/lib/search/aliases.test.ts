/**
 * The compound-name note's matching, as the owner's script on the live site decides it (checked by
 * typing on live, 6 Nov 2026: "reta" shows GLP-3 RTA, "ret" shows nothing, "tirz" shows GLP-2 TRZ).
 */
import { describe, expect, it } from "vitest";

import { SEARCH_ALIASES } from "@/lib/catalog/search";

import { aliasSearchPath, COMPOUND_ALIASES, matchCompoundAliases, translateCompoundNames } from "./aliases";

describe("compound-name aliases", () => {
  it("matches a word that starts the compound's name, from its minimum length", () => {
    expect(matchCompoundAliases("reta")).toEqual(["retatrutide"]);
    expect(matchCompoundAliases("ret")).toEqual([]);
    expect(matchCompoundAliases("tirz")).toEqual(["tirzepatide"]);
    expect(matchCompoundAliases("sema")).toEqual([]); // semaglutide needs 5 letters
    expect(matchCompoundAliases("semag")).toEqual(["semaglutide"]);
    expect(matchCompoundAliases("RETA!")).toEqual(["retatrutide"]);
  });

  it("also matches a word that starts with the name, and lists each compound once, in word order", () => {
    expect(matchCompoundAliases("retatrutide10mg")).toEqual(["retatrutide"]);
    expect(matchCompoundAliases("tirzepatide and reta and retatrutide")).toEqual(["tirzepatide", "retatrutide"]);
    expect(matchCompoundAliases("glp-3 rta")).toEqual([]);
    expect(matchCompoundAliases("")).toEqual([]);
  });

  it("translates the search text word by word, as the owner's code does before WordPress searches", () => {
    expect(translateCompoundNames("reta")).toBe("GLP-3 RTA");
    expect(translateCompoundNames("reta 10mg")).toBe("GLP-3 RTA 10mg");
    expect(translateCompoundNames("retatrutide10mg")).toBe("GLP-3 RTA");
    expect(translateCompoundNames("ret")).toBe("ret");
    expect(translateCompoundNames("sema pen")).toBe("sema pen");
    expect(translateCompoundNames("Tirz")).toBe("GLP-2 TRZ");
  });

  it("links to the code name's product search, and feeds the searches' translation", () => {
    expect(aliasSearchPath("retatrutide")).toBe("/?s=GLP-3+RTA&post_type=product");
    expect(aliasSearchPath("semaglutide")).toBe("/?s=GLP-1+SMA&post_type=product");
    expect(SEARCH_ALIASES).toEqual({ semaglutide: "glp-1 sma", tirzepatide: "glp-2 trz", retatrutide: "glp-3 rta" });
    expect(COMPOUND_ALIASES.retatrutide.note).toBe("Known as retatrutide, it is a triple agonist that activates GLP-1, GIP, and glucagon receptors.");
  });
});
