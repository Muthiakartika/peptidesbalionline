/**
 * What a product page gives src/components/seo/JsonLd.tsx: the product's name and WooCommerce's offers from
 * the catalogue as it is now (src/lib/seo/product-offer.ts), and WooCommerce's whole Product block for a
 * product the live snapshot doesn't have (one made in /admin/products/).
 */
import type { ProductJsonLd } from "@/components/seo/JsonLd";
import type { ProductPageData } from "@/lib/catalog/product-page";
import type { Product } from "@/lib/catalog/types";

import { wooProductOffer, type OfferItem, type StockStatus } from "./product-offer";

const LIVE = "https://peptidesbali.online";

/** wp_strip_all_tags: the text without tags (and without script/style content), trimmed. */
const stripTags = (html: string) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

/** `now`: today (src/lib/seo/offer-date.ts), for the offers' "valid until". */
export function productJsonLd(product: Product, page: ProductPageData, backorder: Record<string, { notify: boolean }>, now: Date): ProductJsonLd {
  const status = (id: number, inStock: boolean): StockStatus => (backorder[String(id)] ? "onbackorder" : inStock ? "instock" : "outofstock");
  const items: OfferItem[] = (
    product.type === "variable"
      ? product.variations.map((v) => ({ price: v.price, regularPrice: v.regularPrice ?? v.price, onSale: Boolean(v.onSale), status: status(v.id, v.inStock) }))
      : [{ price: product.priceMin, regularPrice: product.regularPrice ?? product.priceMin, onSale: Boolean(product.onSale), status: status(product.id, product.inStock) }]
  )
    // A variation without a price can't be bought (Q-17): WooCommerce leaves it out of the offer, as here.
    .filter((item) => item.price > 0n);
  const url = `${LIVE}${product.path}`;
  const offer = wooProductOffer({ type: product.type, url, items }, now);
  const image = page.gallery[0]?.full.src;
  return {
    name: product.name,
    offer,
    block: {
      "@context": "https://schema.org/",
      "@type": "Product",
      "@id": `${url}#product`,
      name: product.name,
      url,
      description: stripTags(page.shortDescription ?? ""),
      ...(image ? { image } : {}),
      sku: String(product.id),
      ...(offer ? { offers: [offer] } : {}),
    },
  };
}
