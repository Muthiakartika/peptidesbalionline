"use server";

/**
 * The product screens' actions (staff only; every action checks the role again: a form can be posted
 * from anywhere). After a change the shop's cached catalogue is refreshed at once (updateTag), so the
 * shop, the product page and the cart show it on the next visit.
 */
import { revalidatePath, updateTag } from "next/cache";

import { getAccountUser, isStaff } from "@/lib/account/session";
import { CATALOG_TAG } from "@/lib/catalog/store";
import { archiveProduct, createProduct, deleteProduct, restoreProduct, updateProduct, type AdminResult } from "@/lib/commerce/product-admin";

async function staffUser() {
  const user = await getAccountUser().catch(() => null);
  if (!user || !isStaff(user)) throw new Error("Sorry, you are not allowed to do that.");
  return user;
}

function done(result: AdminResult): AdminResult {
  if (result.ok) {
    updateTag(CATALOG_TAG);
    // The product route's pages, its shell for products added after the build included: without
    // this a brand-new product's first page could carry the old catalogue's "not found" title.
    revalidatePath("/product/[slug]", "page");
  }
  return result;
}

/** Create (shopId null) or save a product. */
export async function saveProductAction(shopId: number | null, payload: unknown): Promise<AdminResult> {
  const user = await staffUser();
  return done(shopId === null ? await createProduct(payload, user.id) : await updateProduct(shopId, payload, user.id));
}

export async function archiveProductAction(shopId: number): Promise<AdminResult> {
  await staffUser();
  return done(await archiveProduct(shopId));
}

export async function restoreProductAction(shopId: number): Promise<AdminResult> {
  await staffUser();
  return done(await restoreProduct(shopId));
}

export async function deleteProductAction(shopId: number): Promise<AdminResult> {
  await staffUser();
  return done(await deleteProduct(shopId));
}
