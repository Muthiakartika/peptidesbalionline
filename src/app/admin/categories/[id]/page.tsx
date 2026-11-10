/** /admin/categories/<id>/: edit a product category (name, parent, heading, position, picture, SEO). */
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { categoryInUse, listAdminCategories } from "@/lib/commerce/taxonomy-admin";

import { staffOnly } from "../../orders/guard";
import { CategoryEditor } from "../CategoryEditor";

async function EditCategory({ params }: { params: Promise<{ id: string }> }) {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const id = Number((await params).id);
  const all = await listAdminCategories();
  const category = Number.isInteger(id) ? all.find((c) => c.id === id) : undefined;
  if (!category) notFound();
  const categories = all.map(({ id, name, depth, path, parentId }) => ({ id, name, depth, path, parentId }));
  return <CategoryEditor key={`${category.id}-${category.name}-${category.parentId}`} initial={category} categories={categories} deleteBlocked={await categoryInUse(category.id)} />;
}

export default function EditCategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditCategory params={params} />
    </Suspense>
  );
}
