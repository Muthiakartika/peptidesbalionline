/**
 * The author shown on blog posts ("Posted by …").
 *
 * On the live site every post is by one account whose public name is an e-mail address, with its
 * Gravatar picture (risk R-12 in docs/audit/technical-feasibility-report.md, open question Q-14).
 * That address is personal data, so the rebuild never copies it: until the owner chooses the name
 * to show, posts show the store's name and Gravatar's standard "no picture" avatar (the one
 * WordPress shows for accounts without a picture). Change the name here once the owner decides.
 */
export const BLOG_AUTHOR = {
  name: "Atlas Longevity",
  /** Gravatar's standard silhouette, at the size WordPress asks for ("s"), for a given pixel size. */
  avatar: (size: number) => `https://secure.gravatar.com/avatar/?s=${size}&d=mm&r=g`,
};
