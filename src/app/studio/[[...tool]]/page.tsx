/**
 * Sanity Studio, served at /studio/ (the CMS where editors manage products, pages and posts).
 * Until NEXT_PUBLIC_SANITY_PROJECT_ID is set, it shows setup instructions instead.
 */
import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";
import { isSanityConfigured } from "@/sanity/env";

export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  if (!isSanityConfigured) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl">Sanity Studio is not connected yet</h1>
        <p className="mt-4">
          Create a Sanity project (https://www.sanity.io/manage), then add its ID to <code>.env.local</code> as{" "}
          <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> and restart <code>npm run dev</code>. See README → Environment
          variables.
        </p>
      </main>
    );
  }

  return <NextStudio config={config} />;
}
