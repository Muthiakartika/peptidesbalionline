import { defineField, defineType } from "sanity";

/** SEO fields, imported 1:1 from Yoast SEO (yoast_head_json) in Phase 4. */
export const seo = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: "title",
      title: "SEO title",
      type: "string",
      description: "The <title> shown in Google. Leave empty to use the page title. Copied from Yoast.",
    }),
    defineField({
      name: "description",
      title: "Meta description",
      type: "text",
      rows: 3,
      description: "The grey text under the title in Google results (about 150 characters). Copied from Yoast.",
    }),
    defineField({
      name: "canonicalUrl",
      title: "Canonical URL",
      type: "url",
      description: "Only fill this if the page must point Google to a different URL. Usually empty.",
    }),
    defineField({
      name: "noIndex",
      title: "Hide from search engines (noindex)",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "ogImage",
      title: "Social share image",
      type: "image",
      description: "Shown when the page is shared on WhatsApp, Facebook, etc. 1200 × 630 px works best.",
    }),
  ],
});
