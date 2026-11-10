/** /admin/products/new/: add a product (its Sanity document for texts and pictures is made with it). */
import { Suspense } from "react";

import { getCategories } from "@/lib/catalog";
import { listShopAttributes } from "@/lib/commerce/taxonomy-admin";

import { staffOnly } from "../../orders/guard";
import { ProductEditor } from "../ProductEditor";

async function NewProduct() {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const categories = (await getCategories()).map(({ slug, name, id, parent }) => ({ slug, name, id, parent }));
  return <ProductEditor initial={null} categories={categories} shopAttributes={await listShopAttributes()} />;
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewProduct />
    </Suspense>
  );
}
