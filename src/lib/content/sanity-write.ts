/**
 * A Sanity client that can write (server only), for the store admin keeping products' Sanity documents
 * in step (src/lib/commerce/product-admin.ts). Uses SANITY_API_WRITE_TOKEN and the dataset the site
 * reads (NEXT_PUBLIC_SANITY_DATASET). null when either is missing.
 */
import "server-only";

import { createClient, type SanityClient } from "next-sanity";

import { apiVersion, dataset, isSanityConfigured, projectId } from "@/sanity/env";

let client: SanityClient | null | undefined;

export function sanityWriter(): SanityClient | null {
  if (client !== undefined) return client;
  const token = process.env.SANITY_API_WRITE_TOKEN;
  client = token && isSanityConfigured ? createClient({ projectId, dataset, apiVersion, token, useCdn: false }) : null;
  return client;
}
