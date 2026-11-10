/**
 * Everything a product page shows that the shop snapshot (catalog.json) does not have: gallery,
 * breadcrumb trail, short description, the variation form as the page shows it, tabs, related
 * products and Yoast tags. Source: src/content/product-pages.json, made by
 * `python scripts/audit/export_product_pages.py` (Phase 4 moves it to Sanity).
 */
import "server-only";

import { contentFromSanity, getSanityBlock } from "@/lib/content/sanity";

import { getCatalogState } from "./index";
import { snapshotBlocks } from "./snapshot";
import type { CatalogImage, PageSeo } from "./types";

type FullImage = { src: string; width: number; height: number };

/** A gallery picture. `title` is the tooltip shown on hover; `full` is the file the zoom uses. */
export type GalleryImage = CatalogImage & { title?: string | null; full: FullImage };

/** The picture a variation puts first in the gallery (WooCommerce's "single" size, 600×600). */
export type VariationPicture = {
  src: string;
  srcset: string | null;
  sizes: string | null;
  width: number;
  height: number;
  alt: string;
  title: string | null;
  full: FullImage;
};

export type ProductForm =
  | { type: "none" }
  | { type: "simple"; min: number; max: number | null }
  | {
      type: "variable";
      attributes: {
        name: string;
        label: string;
        swatches: boolean;
        options: { value: string; label: string }[];
        /** Option picked when the page opens (WooCommerce "default attributes"). */
        default: string | null;
      }[];
      /** Variation id → its gallery picture. */
      images: Record<string, VariationPicture>;
    };

export type ProductTab = { key: string; title: string; html: string | null };

export type ProductPageData = {
  id: number;
  title: string;
  breadcrumbs: { label: string; path: string | null }[];
  gallery: GalleryImage[];
  thumbnails: CatalogImage[];
  /** HTML, as printed by WordPress (clean it with cleanLegacyHtml before showing it). */
  shortDescription: string | null;
  /** The cream note under the description, e.g. "10 Needles + 10 Alcohol pads included." */
  includedSupplies: string | null;
  form: ProductForm;
  /** Elementor blocks shown under "Add to cart" (ids into getSharedBlock). */
  afterAddToCart: number[];
  /** The owner's "Also available as" box (HTML) or null. */
  connectedFormats: string | null;
  tabs: ProductTab[];
  /** Related product ids. The live site shuffles them on every visit; this is one such order. */
  related: number[];
  /** Elementor documents whose generated CSS the page links (public/legacy/elementor/post-<id>.css). */
  elementorStyles: number[];
  seo: PageSeo;
  /** What the quick-view popup lists under the form ("SKU: N/A", "Categories: …", A–Z). */
  meta: { sku: string | null; categories: { name: string; path: string }[] };
};

/** The product page at this address (async: products come from the store database, ./store.ts). */
export async function getProductPage(path: string): Promise<ProductPageData | undefined> {
  const state = await getCatalogState();
  const product = state.byPath.get(path);
  return product ? state.pages.get(product.id) : undefined;
}

/** Elementor block HTML shared by many products (e.g. #701, the buttons under "Add to cart"). */
export function getSharedBlock(id: number): string | undefined {
  return snapshotBlocks[String(id)];
}

/** The block's HTML, from Sanity ("Shared sections") when the site reads Sanity, else the copy above. */
export async function getSharedBlockHtml(id: number): Promise<string | undefined> {
  if (contentFromSanity) {
    const html = await getSanityBlock(id);
    if (html) return html;
  }
  return getSharedBlock(id);
}
