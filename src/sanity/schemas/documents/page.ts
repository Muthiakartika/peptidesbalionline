import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A page of the site (home, compound, price, goal, area and city pages, info, legal and affiliate
 * pages), built from sections like in Elementor. Imported from the live site by
 * scripts/sanity/import-content.mjs; the website renders it in src/lib/content/.
 */
export const FAMILIES = [
  { title: "Homepage", value: "home" },
  { title: "Compound pages", value: "compound" },
  { title: "Price pages", value: "price" },
  { title: "Goal pages", value: "goal" },
  { title: "Bali area pages", value: "bali-area" },
  { title: "City pages", value: "city" },
  { title: "Blog index", value: "blog" },
  { title: "Information pages", value: "info" },
  { title: "Legal pages", value: "legal" },
  { title: "Affiliate pages", value: "affiliate" },
];

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
    { name: "advanced", title: "Advanced" },
  ],
  fields: [
    defineField({ name: "title", title: "Name", type: "string", group: "content", description: "For finding the page here. The title Google shows is under SEO.", validation: (rule) => rule.required() }),
    defineField({
      name: "path",
      title: "Address",
      type: "string",
      group: "content",
      readOnly: true,
      description: "e.g. /bpc-157-bali/ (kept identical to WordPress for SEO).",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      group: "content",
      description: "Drag to reorder. Add a section, or place a shared section (edited once for every page that uses it).",
      of: [defineArrayMember({ type: "elSection" }), defineArrayMember({ type: "sharedSectionRef" })],
      hidden: ({ document }) => Boolean(document?.plain),
    }),
    defineField({ name: "body", title: "Content", type: "richText", group: "content", hidden: ({ document }) => !document?.plain }),
    defineField({ name: "seo", title: "SEO", type: "pageSeo", group: "seo" }),
    defineField({ name: "family", title: "Kind of page", type: "string", group: "advanced", options: { list: FAMILIES }, readOnly: true }),
    defineField({ name: "name", title: "File name", type: "string", group: "advanced", readOnly: true }),
    defineField({ name: "docId", title: "Elementor document id", type: "number", group: "advanced", readOnly: true, description: "Its styles: /legacy/elementor/post-<id>.css" }),
    defineField({ name: "plain", title: "Plain WordPress page (no Elementor)", type: "boolean", group: "advanced", readOnly: true }),
    defineField({ name: "articleClass", title: "Article classes", type: "string", group: "advanced", readOnly: true }),
    defineField({ name: "stylesheets", title: "Elementor stylesheets", type: "array", group: "advanced", readOnly: true, of: [defineArrayMember({ type: "number" })] }),
    defineField({ name: "pageTitleHtml", title: "Title band (HTML)", type: "text", group: "advanced", readOnly: true, rows: 3 }),
    defineField({ name: "rootAttrs", type: "string", hidden: true }),
    defineField({ name: "bodyMeta", type: "string", hidden: true }),
    defineField({ name: "toolConfig", type: "text", hidden: true }),
    defineField({ name: "toolScripts", type: "array", hidden: true, of: [defineArrayMember({ type: "string" })] }),
  ],
  preview: { select: { title: "title", subtitle: "path" } },
});
