/**
 * A Woodmart "products" widget inside an Elementor page (e.g. "Our Most Popular Products" on the
 * homepage). The live page prints the cards on the server; here they come from the catalogue, so
 * prices, options and the quick view are the same as in the shop (ProductCard).
 * The grid keeps the live wrapper classes and its column/gap settings (--wd-col-lg/md/sm …).
 *
 * "Recently viewed products" (the visitor's own list) is filled in the browser: RecentlyViewed.tsx.
 */
import type { CSSProperties } from "react";

import { ProductCard } from "@/components/shop/ProductCard";
import { getProductById } from "@/lib/catalog";
import type { Product } from "@/lib/catalog/types";

import { RecentlyViewed } from "./RecentlyViewed";

export type ProductGridProps = {
  ids: number[];
  gridClass: string;
  /** e.g. "--wd-col-lg:4;--wd-col-md:4;--wd-col-sm:2;--wd-gap-lg:20px;--wd-gap-sm:10px;" */
  gridStyle: string;
  hidden: boolean;
  recentlyViewed: boolean;
  limit: number;
  categories: number[];
};

/** "--a:1;--b:2px;" -> { "--a": "1", "--b": "2px" } */
export function styleFromString(style: string): CSSProperties {
  return Object.fromEntries(
    style
      .split(";")
      .map((part) => part.split(":").map((s) => s.trim()))
      .filter(([name, value]) => name && value),
  ) as CSSProperties;
}

export async function ProductGridIsland({ ids, gridClass, gridStyle, hidden, recentlyViewed, limit, categories }: ProductGridProps) {
  if (recentlyViewed) {
    return <RecentlyViewed gridClass={gridClass} gridStyle={styleFromString(gridStyle)} limit={limit} categories={categories} />;
  }
  const products = (await Promise.all(ids.map((id) => getProductById(id)))).filter((p): p is Product => Boolean(p));
  return (
    <div className="elementor-widget-container">
      <div className={`wd-products-element${hidden ? " wd-hide" : ""}`}>
        <div className={gridClass} style={styleFromString(gridStyle)}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
