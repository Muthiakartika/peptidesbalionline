/**
 * The "offers" part of a product's structured data, as WooCommerce 11.2.1 writes it
 * (WC_Structured_Data::generate_product_data), from the shop's prices and stock as they are now, so the
 * price and availability search engines read always match the page (Google Merchant Center compares them):
 *   * a variable product: AggregateOffer (lowPrice, highPrice, offerCount = priced variations), or a single
 *     Offer when every variation costs the same; on sale, the lowest sale price as a SalePrice specification;
 *   * a simple product: Offer with its price as UnitPriceSpecification (on sale: the sale price first and
 *     the regular price marked ListPrice);
 *   * priceValidUntil / validThrough: 31 December of next year (the sale's end when it has one);
 *   * availability: InStock, BackOrder (on backorder) or OutOfStock; a variable product is in stock when any
 *     variation is, else on backorder when any is (WooCommerce's sync_stock_status).
 * Addresses use the live domain; src/components/seo/JsonLd.tsx moves them to this site's own, as for the rest.
 */
export type StockStatus = "instock" | "onbackorder" | "outofstock";

export type OfferItem = { price: bigint; regularPrice: bigint; onSale: boolean; saleTo?: string | null; status: StockStatus };

export type OfferProduct = {
  type: "simple" | "variable";
  /** The product page's address on the live domain, e.g. "https://peptidesbali.online/product/nad-500mg/". */
  url: string;
  /** A simple product: one item; a variable product: its priced variations. */
  items: OfferItem[];
};

const LIVE = "https://peptidesbali.online";
const CURRENCY = "IDR";

/** wc_format_decimal with the shop's 2 decimals: 160000000n (minor) → "1600000.00". */
export const decimal = (minor: bigint) => `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;

/** WooCommerce's parent stock status of a variable product. */
export function parentStatus(items: OfferItem[]): StockStatus {
  if (items.some((i) => i.status === "instock")) return "instock";
  if (items.some((i) => i.status === "onbackorder")) return "onbackorder";
  return "outofstock";
}

const availability = (status: StockStatus) => `https://schema.org/${status === "instock" ? "InStock" : status === "onbackorder" ? "BackOrder" : "OutOfStock"}`;

export function wooProductOffer(product: OfferProduct, now: Date = new Date()): Record<string, unknown> | null {
  if (!product.items.length) return null;
  // gmdate('Y-12-31', time() + YEAR_IN_SECONDS)
  const nextYear = `${new Date(now.getTime() + 365 * 24 * 3600 * 1000).getUTCFullYear()}-12-31`;
  const spec = (price: bigint, validThrough: string, priceType?: string) => ({
    "@type": "UnitPriceSpecification",
    ...(priceType ? { priceType } : {}),
    price: decimal(price),
    priceCurrency: CURRENCY,
    validThrough,
  });
  let offer: Record<string, unknown>;
  let saleValidUntil: string | null = null;
  let status: StockStatus;

  if (product.type === "variable") {
    const prices = product.items.map((i) => i.price);
    const lowest = prices.reduce((a, b) => (b < a ? b : a));
    const highest = prices.reduce((a, b) => (b > a ? b : a));
    if (lowest === highest) {
      offer = { "@type": "Offer", priceSpecification: [spec(lowest, nextYear)] };
    } else {
      offer = { "@type": "AggregateOffer", lowPrice: decimal(lowest), highPrice: decimal(highest), offerCount: product.items.length };
      if (product.items.some((i) => i.onSale)) {
        const cheapest = product.items.reduce((a, b) => (b.price < a.price ? b : a));
        saleValidUntil = cheapest.onSale && cheapest.saleTo ? cheapest.saleTo.slice(0, 10) : null;
        offer.priceSpecification = [spec(lowest, saleValidUntil ?? nextYear, "https://schema.org/SalePrice")];
      }
    }
    status = parentStatus(product.items);
  } else {
    const item = product.items[0];
    const specs = [spec(item.regularPrice, nextYear, item.onSale ? "https://schema.org/ListPrice" : undefined)];
    if (item.onSale) {
      saleValidUntil = item.saleTo ? item.saleTo.slice(0, 10) : null;
      specs.unshift(spec(item.price, saleValidUntil ?? nextYear));
    }
    offer = { "@type": "Offer", priceSpecification: specs };
    status = item.status;
  }

  offer.priceValidUntil = saleValidUntil ?? nextYear;
  offer.availability = availability(status);
  offer.url = product.url;
  offer.seller = { "@type": "Organization", name: "Atlas Longevity", url: LIVE };
  if (offer["@type"] === "Offer") offer.price = (offer.priceSpecification as { price: string }[])[0].price;
  offer.priceCurrency = CURRENCY;
  return offer;
}
