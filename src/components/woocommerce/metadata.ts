/**
 * <head> tags of the WooCommerce pages, as Yoast prints them on the live site: "<page> - Atlas
 * Longevity", noindex (follow), Open Graph type "article" with the page's address (the account
 * addresses all give /my-account/). No canonical link and no description, as live.
 */
import type { Metadata } from "next";

import { isProduction } from "@/lib/site";

export function wooMetadata(title: "Cart" | "Checkout" | "My account", ogPath: "/cart/" | "/checkout/" | "/my-account/"): Metadata {
  const fullTitle = `${title} - Atlas Longevity`;
  return {
    title: fullTitle,
    ...(isProduction ? { robots: { index: false, follow: true } } : {}),
    openGraph: { locale: "en_US", type: "article", title: fullTitle, url: ogPath, siteName: "Atlas Longevity" },
    twitter: { card: "summary_large_image" },
  };
}
