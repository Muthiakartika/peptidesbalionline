/**
 * Catch-all for every URL that has no page. It shows the 404 page inside the normal header and
 * footer (src/app/(store)/not-found.tsx), like WordPress does, with status 404: the page calls
 * notFound() while it's built in advance, so it's one ready-made 404 page for every such address.
 *
 * The 52 landing pages (/bpc-157-bali/, /peptide/jakarta/, …) never reach this route: src/proxy.ts
 * sends them to src/app/(store)/landing/[name]/page.tsx. Phase 3f does the same for the blog posts.
 */
import { notFound } from "next/navigation";

// This page always answers 404, which Next.js 16's dev-only "instant navigation" check reports as
// an error. Opt out. Docs:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

export default function CatchAllPage() {
  notFound();
}
