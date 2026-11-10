"use client";

/**
 * Sanity Studio configuration. The Studio is embedded in the Next.js app at /studio/
 * (src/app/studio/[[...tool]]/page.tsx). "use client" is required: the Studio is a browser
 * app, and loading it during server rendering breaks the build.
 */
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { dataset, projectId } from "./src/sanity/env";
import { schemaTypes, singletonTypes } from "./src/sanity/schemas";
import { structure } from "./src/sanity/structure";

import { StudioIcon } from "./src/sanity/StudioIcon";

/** Document types the store admin creates and deletes (the Studio only edits their content). */
const ADMIN_MANAGED = new Set(["product"]);

export default defineConfig({
  name: "default",
  // Named after the project (not the "Atlas Longevity" brand) so it is easy to tell apart from
  // other Atlas projects in the Sanity dashboard and workspace switcher.
  // Every dataset other than the live "production" one gets its name in capitals after the title
  // (e.g. "Peptides Bali Online · STAGING"), so a staging Studio is never mistaken for the live one.
  title: dataset === "production" ? "Peptides Bali Online" : `Peptides Bali Online · ${dataset.toUpperCase()}`,
  // Shown under the title in the workspace menu (click the title, top-left).
  subtitle: `Dataset: ${dataset}`,
  icon: StudioIcon,
  basePath: "/studio",
  projectId: projectId || "not-configured",
  dataset,
  // Log in with a token kept by the browser (not a sanity.io cookie): the picture uploads
  // (/api/media/upload) send it so the site can check the editor with Sanity. See docs/setup/r2.md.
  auth: { loginMethod: "token" },
  plugins: [structureTool({ structure })],
  schema: {
    types: schemaTypes,
    // No "create new" for singletons (one Site settings document) nor for products: products are added
    // in the store admin (/admin/products/), which makes their document here.
    templates: (templates) => templates.filter(({ schemaType }) => !singletonTypes.has(schemaType) && !ADMIN_MANAGED.has(schemaType)),
  },
  document: {
    // Products are deleted (and archived) in the store admin, which removes their document here too.
    actions: (actions, { schemaType }) =>
      singletonTypes.has(schemaType) || ADMIN_MANAGED.has(schemaType) ? actions.filter(({ action }) => action !== "duplicate" && action !== "delete") : actions,
  },
});
