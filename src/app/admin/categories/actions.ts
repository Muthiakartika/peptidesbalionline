"use server";

/** The category screens' actions (staff only). After a change the whole shop shows it at once. */
import { createCategory, deleteCategory, updateCategory, type TaxonomyResult } from "@/lib/commerce/taxonomy-admin";

import { refreshShop, staffUser } from "../staff-actions";

function done(result: TaxonomyResult): TaxonomyResult {
  if (result.ok) refreshShop();
  return result;
}

/** Create (id null) or save a category. */
export async function saveCategoryAction(id: number | null, payload: unknown): Promise<TaxonomyResult> {
  await staffUser();
  return done(id === null ? await createCategory(payload) : await updateCategory(id, payload));
}

export async function deleteCategoryAction(id: number): Promise<TaxonomyResult> {
  await staffUser();
  return done(await deleteCategory(id));
}
