/**
 * The site search against the live site's own results (site-search-samples.json: every result of
 * 4 searches on https://peptidesbali.online on 5 Nov 2026, [id, type, title] in order).
 */
import { describe, expect, it } from "vitest";

import postsData from "../../content/blog/posts.json";
import samples from "./site-search-samples.json";
import { searchExcerpt, siteSearch, withoutEmbeddedDocuments } from "./site-search";

// The live samples are from 5 Nov 2026: the posts added later from WordPress drafts aren't in them.
const drafts = new Set(postsData.filter((post) => "wpStatus" in post).map((post) => post.id));
const live = (term: string) => (samples as unknown as Record<string, [number, string, string][]>)[term].map((row) => row[0]);
const ids = async (term: string) => (await siteSearch({ query: term })).map((doc) => doc.id).filter((id) => !drafts.has(id));

describe("site search", () => {
  it("finds the posts added from WordPress drafts", async () => {
    const results = await siteSearch({ query: "cagrisema" });
    expect(results.map((doc) => doc.id)).toContain(12846); // /what-is-cagrisema/
  });

  it('finds exactly what the live site finds for "bpc", in the same order (85 results)', async () => {
    expect(await ids("bpc")).toEqual(live("bpc"));
  });

  it('searches "tirzepatide" as the live site does: as "glp-2 trz" (39 results, same order)', async () => {
    expect(await ids("tirzepatide")).toEqual(live("tirzepatide"));
  });

  it('lists the live results for "glow" in the same order, plus the homepage', async () => {
    // The homepage's product grid shows the Glow Bundle; WordPress's stored copy of the page doesn't.
    expect((await ids("glow")).filter((id) => id !== 7282)).toEqual(live("glow"));
  });

  it('finds 184 of the 185 live results for "bali peptides", the first 109 in the same order', async () => {
    const ours = await ids("bali peptides");
    const expected = live("bali peptides");
    expect(expected.filter((id) => !ours.includes(id))).toEqual([1248]); // its stored description says more than ours
    // Extra: 4 pages whose text WordPress stores as a shortcode (Protocol Builder, affiliate pages).
    expect(ours.filter((id) => !expected.includes(id)).sort()).toEqual([10970, 8870, 8871, 8872].sort());
    expect(ours.filter((id) => expected.includes(id)).slice(0, 109)).toEqual(expected.slice(0, 109));
  });

  it("only searches posts with post_type=post (the search form of the empty results page)", async () => {
    const posts = await siteSearch({ query: "bpc", postType: "post" });
    expect(posts.every((doc) => doc.type === "post")).toBe(true);
    expect(posts.map((doc) => doc.id)).toEqual(live("bpc").filter((id) => posts.some((doc) => doc.id === id)));
  });
});

describe("search helpers", () => {
  it("cuts the excerpt after 20 words, like WordPress", () => {
    const text = Array.from({ length: 30 }, (_, i) => `w${i + 1}`).join(" ");
    expect(searchExcerpt(text).split(" ")).toHaveLength(20);
    expect(searchExcerpt("one  two\nthree")).toBe("one two three");
  });

  it("drops Elementor blocks placed in a description from elsewhere, keeping the product's own", () => {
    const html = '<p>a</p><div data-elementor-id="7"><div><p>bpc</p></div></div><div data-elementor-id="5"><p>own</p></div><p>z</p>';
    expect(withoutEmbeddedDocuments(html, 5)).toBe('<p>a</p><div data-elementor-id="5"><p>own</p></div><p>z</p>');
  });
});
