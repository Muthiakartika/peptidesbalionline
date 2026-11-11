/**
 * Pages copied from the live site: the homepage (Phase 3d), the 52 landing pages (Phase 3e:
 * compounds, prices, goals, Bali areas, Indonesian cities), /insights/ (3f) and the information,
 * legal and affiliate pages (3g; four of these are plain WordPress pages, without Elementor). Source:
 * src/content/pages/<name>.json, made by `python scripts/audit/export_elementor_pages.py`, which
 * also writes src/content/pages/index.ts (which page lives at which address) and files.ts (how to
 * load each one). Phase 4 moves the sections to Sanity.
 */
import "server-only";

import { elementorPageNames } from "@/content/pages";
import { elementorPageFiles } from "@/content/pages/files";
import { contentFromSanity, getSanityPage } from "@/lib/content/sanity";

import type { PageSeo } from "@/lib/catalog/types";

export type ElementorPageData = {
  generatedAt: string;
  /** The page's address, e.g. "/bpc-157-bali/". */
  path: string;
  /** Which kind of page it is (docs/audit/page-inventory.md): "home", "compound", "price", "goal",
   * "bali-area", "city", "blog" (/insights/), "info", "legal" or "affiliate". */
  family: string;
  /** Elementor document id, e.g. 1588 (its CSS: public/legacy/elementor/post-<id>.css; the
   * homepage's, #7282, is bundled: src/styles/legacy/post-7282.css). */
  docId: number;
  /** Elementor documents whose CSS the live page loads, in the live order. */
  stylesheets: number[];
  /** The classes of the <article> WordPress wraps the page in. */
  articleClass: string;
  /** The theme's black title band above the content, as WordPress printed it (only some pages, e.g.
   * /insights/; missing or "" for the others). */
  pageTitleHtml?: string;
  /** The Elementor document as WordPress printed it; for a plain page, what its <article> holds. */
  html: string;
  /** A plain WordPress page (no Elementor: the affiliate area, login, registration and terms). Its
   * `docId` is then the page's own id. */
  plain?: boolean;
  /** The owner's Atlas Research Planner tools (/calculator/): the JSON configuration the live page
   * prints for the plugin's script, and that script (copied to public/legacy/vendor/). */
  toolConfig?: string;
  toolScripts?: string[];
  seo: PageSeo;
};

/** A page's name: its file name without ".json", e.g. "home", "bpc-157-bali", "peptide-jakarta". */
export type ElementorPageName = keyof typeof elementorPageFiles;

/** The landing pages' names (every page but the homepage). */
export const landingPageNames = (Object.values(elementorPageNames) as ElementorPageName[]).filter((name) => name !== "home");

export function isElementorPageName(name: string): name is ElementorPageName {
  return Object.hasOwn(elementorPageFiles, name);
}

/** The page with this name, or null. Each page's file is loaded only when it's asked for, so a page
 * doesn't carry the other 52 with it. */
/** Pages never read from Sanity (and hidden in the Studio, src/sanity/structure.ts). */
export const FIXED_PAGES = new Set(["calculator"]);

export async function getElementorPage(name: string): Promise<ElementorPageData | null> {
  if (!isElementorPageName(name)) return null;
  // Edited in Sanity (CONTENT_SOURCE=sanity, src/lib/content/sanity.ts); a page missing there falls
  // back to its copy in src/content/pages/. The tool pages (/calculator/, like /protocol-builder/)
  // are not editable: they always come from their copy here (owner's choice, 11 Nov 2026).
  if (contentFromSanity && !FIXED_PAGES.has(name)) {
    const page = await getSanityPage(name);
    if (page) return page;
  }
  const file = await elementorPageFiles[name]();
  return file.default as ElementorPageData;
}
