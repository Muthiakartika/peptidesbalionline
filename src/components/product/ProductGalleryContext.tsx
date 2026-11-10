"use client";

/**
 * Shares the variation picked in the add-to-cart form with the rest of the summary, as on the
 * live page: the gallery shows that variation's picture and the price at the top of the summary
 * shows its price (Woodmart's "price outside" form).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { VariationPicture } from "@/lib/catalog/product-page";
import type { Variation } from "@/lib/catalog/types";

type ProductState = {
  variation: Variation | null;
  variationImage: VariationPicture | null;
  showVariation: (variation: Variation | null) => void;
};

const ProductStateContext = createContext<ProductState>({ variation: null, variationImage: null, showVariation: () => {} });

/** `images`: variation id → the picture it shows (from the page's variation form). */
export function ProductGalleryProvider({ images = {}, children }: { images?: Record<string, VariationPicture>; children: ReactNode }) {
  const [variation, setVariation] = useState<Variation | null>(null);
  const value = useMemo(
    () => ({ variation, variationImage: variation ? (images[String(variation.id)] ?? null) : null, showVariation: setVariation }),
    [variation, images],
  );
  return <ProductStateContext.Provider value={value}>{children}</ProductStateContext.Provider>;
}

export function useProductGallery(): ProductState {
  return useContext(ProductStateContext);
}
