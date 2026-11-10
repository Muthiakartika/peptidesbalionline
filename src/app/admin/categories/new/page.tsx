/** /admin/categories/new/: add a product category. */
import { Suspense } from "react";

import { listAdminCategories } from "@/lib/commerce/taxonomy-admin";

import { staffOnly } from "../../orders/guard";
import { CategoryEditor } from "../CategoryEditor";

async function NewCategory() {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const categories = (await listAdminCategories()).map(({ id, name, depth, path, parentId }) => ({ id, name, depth, path, parentId }));
  return <CategoryEditor initial={null} categories={categories} deleteBlocked={null} />;
}

export default function NewCategoryPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewCategory />
    </Suspense>
  );
}
