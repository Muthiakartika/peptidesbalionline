/** /admin/products/<number>/: edit a product's prices, stock, variations, categories and status. */
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCategories } from "@/lib/catalog";
import { listShopAttributes } from "@/lib/commerce/taxonomy-admin";
import { getEditorProduct } from "@/lib/commerce/product-admin";

import { staffOnly } from "../../orders/guard";
import { ProductEditor } from "../ProductEditor";

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const shopId = Number((await params).id);
  const product = Number.isInteger(shopId) ? await getEditorProduct(shopId) : null;
  if (!product) notFound();
  const categories = (await getCategories()).map(({ slug, name, id, parent }) => ({ slug, name, id, parent }));
  return <ProductEditor key={`${product.shopId}-${product.storeStatus}`} initial={product} categories={categories} shopAttributes={await listShopAttributes()} />;
}

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditProduct params={params} />
    </Suspense>
  );
}
