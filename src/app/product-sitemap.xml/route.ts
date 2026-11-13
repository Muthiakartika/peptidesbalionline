// /product-sitemap.xml: /shop/ and the shop's products as they are now (src/lib/seo/sitemaps.ts).
import { shopSitemaps } from "@/lib/seo/sitemap-data";
import { sitemapResponse, sitemapXml } from "@/lib/seo/sitemaps";

export async function GET() {
  return sitemapResponse("product", sitemapXml("product", (await shopSitemaps()).product));
}
