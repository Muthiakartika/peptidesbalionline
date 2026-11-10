/**
 * Read-only Sanity client for Server Components. GROQ queries live in src/sanity/queries/.
 *
 *   import { getSanityClient } from "@/sanity/lib/client";
 *   const products = await getSanityClient().fetch(`*[_type == "product"]{name, "slug": slug.current}`);
 */
import "server-only";
import { createClient, type SanityClient } from "next-sanity";
import { apiVersion, dataset, isSanityConfigured, projectId } from "../env";

let client: SanityClient | undefined;

export function getSanityClient(): SanityClient {
  if (!isSanityConfigured) {
    throw new Error("Sanity is not configured. Set NEXT_PUBLIC_SANITY_PROJECT_ID in .env.local.");
  }
  client ??= createClient({ projectId, dataset, apiVersion, useCdn: true, perspective: "published" });
  return client;
}
