import { defineField, defineType } from "sanity";

/**
 * HTML copied word-for-word from WordPress (product descriptions, some page sections).
 * It keeps the live site's layout exactly while we migrate (feasibility report §3.2, option A).
 * The website sanitises it before rendering. Editors can replace it with rich text later.
 */
export const legacyHtml = defineType({
  name: "legacyHtml",
  title: "Original WordPress HTML",
  type: "object",
  fields: [
    defineField({
      name: "html",
      title: "HTML",
      type: "text",
      rows: 12,
      description: "Copied from WordPress during migration. Edit with care: it is shown exactly as written.",
    }),
    defineField({
      name: "source",
      title: "Copied from",
      type: "string",
      readOnly: true,
      description: "The WordPress field this came from, for reference.",
    }),
  ],
  preview: {
    select: { source: "source" },
    prepare: ({ source }) => ({ title: "Original WordPress HTML", subtitle: source }),
  },
});
