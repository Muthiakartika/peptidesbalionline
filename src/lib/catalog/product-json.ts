/**
 * Products travel to the browser as JSON (e.g. /api/products/), and JSON has no bigint: prices are
 * sent as strings and turned back into bigint on arrival. Safe to import on both sides.
 */
import type { Product } from "./types";

export type ProductJson = Omit<Product, "priceMin" | "priceMax" | "regularPrice" | "variations"> & {
  priceMin: string;
  priceMax: string;
  regularPrice?: string;
  variations: (Omit<Product["variations"][number], "price" | "regularPrice"> & { price: string; regularPrice?: string })[];
};

const optional = (value: bigint | undefined) => (value === undefined ? {} : { regularPrice: value.toString() });
const optionalBig = (value: string | undefined) => (value === undefined ? {} : { regularPrice: BigInt(value) });

export function productToJson(product: Product): ProductJson {
  const { regularPrice, ...rest } = product;
  return {
    ...rest,
    ...optional(regularPrice),
    priceMin: product.priceMin.toString(),
    priceMax: product.priceMax.toString(),
    variations: product.variations.map(({ regularPrice: regular, ...v }) => ({ ...v, ...optional(regular), price: v.price.toString() })),
  };
}

export function productFromJson(json: ProductJson): Product {
  const { regularPrice, ...rest } = json;
  return {
    ...rest,
    ...optionalBig(regularPrice),
    priceMin: BigInt(json.priceMin),
    priceMax: BigInt(json.priceMax),
    variations: json.variations.map(({ regularPrice: regular, ...v }) => ({ ...v, ...optionalBig(regular), price: BigInt(v.price) })),
  };
}
