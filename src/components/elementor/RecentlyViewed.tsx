"use client";

/**
 * Woodmart "Recently viewed products" grid: the products this visitor opened (most recent first),
 * limited to the widget's categories and number. Hidden while the list is empty, as on the live site.
 */
import { useEffect, useState, type CSSProperties } from "react";

import { ProductCard } from "@/components/shop/ProductCard";
import { productFromJson, type ProductJson } from "@/lib/catalog/product-json";
import type { Product } from "@/lib/catalog/types";
import { readRecentlyViewed } from "@/lib/recently-viewed";

export function RecentlyViewed({ gridClass, gridStyle, limit, categories }: { gridClass: string; gridStyle: CSSProperties; limit: number; categories: number[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    const ids = readRecentlyViewed();
    if (ids.length === 0) return;
    const controller = new AbortController();
    fetch(`/api/products/?ids=${ids.join(",")}&category=${categories.join(",")}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((list: ProductJson[]) => setProducts(list.slice(0, limit || list.length).map(productFromJson)))
      .catch(() => {});
    return () => controller.abort();
  }, [categories, limit]);
  return (
    <div className="elementor-widget-container">
      <div className={`wd-products-element${products.length ? "" : " wd-hide"}`}>
        <div className={gridClass} style={gridStyle}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
