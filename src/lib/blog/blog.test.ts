/**
 * The blog snapshot (src/content/blog/, made by scripts/audit/export_blog.py) and the rules the
 * rebuild uses to print it, against what the live pages print.
 */
import { describe, expect, it } from "vitest";

import { getAllPosts, getCategories, getPostsInCategory, paginate } from "./data";
import { cardDate, longDate } from "./dates";
import { blogPageLinks } from "./pagination";

const labels = (current: number, total: number) => blogPageLinks(current, total).map((link) => (link.current ? `[${link.label}]` : link.label)).join(" ");

describe("blog data", () => {
  // 54 published posts + the 11 GLP drafts added from wp-admin on 11 Nov 2026 (import_wordpress_drafts.py).
  it("has the 65 posts (11 of them WordPress drafts) in 8 categories, newest first", () => {
    const posts = getAllPosts();
    expect(posts).toHaveLength(65);
    expect(posts.filter((post) => "wpStatus" in post && post.wpStatus === "draft")).toHaveLength(11);
    expect(getCategories()).toHaveLength(8);
    expect(posts.map((post) => post.date)).toEqual([...posts.map((post) => post.date)].sort().reverse());
  });

  it("prints every date as the live pages do", () => {
    // Drafts have no live page: their preview prints the preview's own time, and WordPress gives them
    // their publish date later.
    for (const post of getAllPosts().filter((post) => !("wpStatus" in post))) {
      expect(`On ${longDate(post.date)}`).toBe(post.printed.published);
      expect(longDate(post.modified)).toBe(post.printed.modified);
    }
    expect(cardDate("2026-11-01T09:27:58")).toEqual({ day: "01", month: "Nov" });
  });

  it('links each post to the next newer and older one ("Newer" / "Older"), as live', () => {
    const posts = getAllPosts();
    posts.forEach((post, i) => {
      expect(post.newer?.path ?? null).toBe(posts[i - 1]?.path ?? null);
      expect(post.older?.path ?? null).toBe(posts[i + 1]?.path ?? null);
    });
  });

  it("lists each category's posts in the live archive's order, 10 per page", () => {
    for (const category of getCategories() as (ReturnType<typeof getCategories>[number] & { postIds: number[] })[]) {
      const posts = getPostsInCategory(category);
      expect(posts.map((post) => post.id)).toEqual(category.postIds);
      expect(paginate(posts, 1).totalPages).toBe(category.pages.length);
    }
  });

  it("never contains the author's e-mail address or Gravatar hash (R-12)", () => {
    const text = JSON.stringify(getAllPosts());
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(text).not.toMatch(/\/avatar\/[0-9a-f]{20,}/);
    expect(text).not.toContain("/author/");
  });
});

describe("blog page links", () => {
  it("shows up to 5 numbers, with arrows only when there are more pages (measured on live)", () => {
    expect(labels(1, 1)).toBe("");
    expect(labels(1, 5)).toBe("[1] 2 3 4 5");
    expect(labels(5, 5)).toBe("1 2 3 4 [5]");
    expect(labels(1, 9)).toBe("[1] 2 3 › »");
    expect(labels(2, 9)).toBe("‹ 1 [2] 3 4 › »");
    expect(labels(3, 9)).toBe("‹ 1 2 [3] 4 5 › »");
    expect(labels(6, 9)).toBe("« ‹ 4 5 [6] 7 8 › »");
    expect(labels(9, 9)).toBe("« ‹ 7 8 [9]");
  });
});

describe("pasted code viewers", () => {
  it("turns a ChatGPT code viewer with one title per line into a list, and leaves real code alone", async () => {
    const { withoutPastedCodeViewers } = await import("./article-html");
    const pasted = `<div class="cm-editor"><pre class="cm-content q9tKkq_readonly m-0"><code>Introduction\n\nWhat Are Peptides?\n</code></pre></div>`;
    expect(withoutPastedCodeViewers(pasted)).toBe(`<div class="cm-editor"><ul><li>Introduction</li><li>What Are Peptides?</li></ul></div>`);
    const code = `<pre class="cm-content"><code>const a = 1;\nreturn a;</code></pre>`;
    expect(withoutPastedCodeViewers(code)).toBe(code);
  });
});
