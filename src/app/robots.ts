import type { MetadataRoute } from "next";
import { isProduction, siteUrl } from "@/lib/site";

/**
 * /robots.txt
 *
 * Production: the same rules as https://peptidesbali.online/robots.txt on 3 Nov 2026
 * (WooCommerce/Woodmart rules + the Yoast block). Kept identical on purpose, even the
 * WordPress paths, so search engines see no change at cutover.
 * Everywhere else: block all crawling.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/wp-admin/admin-ajax.php",
        disallow: [
          "/wp-content/uploads/wc-logs/",
          "/wp-content/uploads/woocommerce_transient_files/",
          "/wp-content/uploads/woocommerce_uploads/",
          "/*?add-to-cart=*",
          "/*?*add-to-cart=",
          "/wp-admin/",
          "/*?shop_view=",
          "/*?per_page=",
          "/*?per_row=",
          "/*?s=",
          "/*?post_type=",
          "/*?p=",
          "/*?cms_block=",
          "/*?*&shop_view=",
          "/*?*&per_page=",
          "/*?*&per_row=",
          "/*?*&s=",
          "/*?*&post_type=",
          "/*?*&p=",
          "/*?*&cms_block=",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap_index.xml`,
  };
}
