/** Shape of /api/quick-view/?id=… answers (shared by the route and the quick-view popup). */
import type { GalleryImage, ProductForm } from "@/lib/catalog/product-page";

export type QuickViewResponse = {
  id: number;
  title: string;
  path: string;
  gallery: GalleryImage[];
  /** The cream "included supplies" note, cleaned HTML, or null. */
  includedSupplies: string | null;
  form: ProductForm;
  sku: string | null;
  categories: { name: string; path: string }[];
  // Money travels as strings (JSON has no bigint); the browser turns them back into bigint.
  priceMin: string;
  priceMax: string;
  /** The regular price shown struck through while a sale runs. */
  regularPrice?: string;
  variations: { id: number; attributes: Record<string, string>; price: string; inStock: boolean; regularPrice?: string }[];
  /** On backorder, by product / variation number (see AddToCartForm). */
  backorder: Record<string, { notify: boolean }>;
};
