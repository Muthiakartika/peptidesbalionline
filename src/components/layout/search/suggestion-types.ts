/** Shape of /api/search-suggestions/ answers (shared by the route and the search overlay). */
import type { CatalogImage, QuickShopAttribute } from "@/lib/catalog/types";

export type SuggestionProduct = {
  id: number;
  name: string;
  path: string;
  type: "simple" | "variable";
  image: CatalogImage | null;
  /** Minor units as strings. */
  priceMin: string;
  priceMax: string;
  /** The regular price shown struck through while a sale runs (see src/lib/catalog/sale.ts). */
  regularPrice?: string;
  options: Omit<QuickShopAttribute, "swatches">[];
  variations: { id: number; attributes: Record<string, string>; price: string; regularPrice?: string }[];
};

export type SuggestionResponse = {
  query: string;
  categories: { name: string; path: string; image: CatalogImage | null }[];
  products: SuggestionProduct[];
};
