import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A section shown in several places: edit it here once and every page that uses it changes (e.g. the
 * "Contact us today" band on the landing pages, or the buttons under "Add to cart" on every product
 * page). Pages place it with a "Shared section" item in their section list.
 */
export const sharedSection = defineType({
  name: "sharedSection",
  title: "Shared section",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Name", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      of: [defineArrayMember({ type: "elSection" })],
      validation: (rule) => rule.min(1),
    }),
    defineField({ name: "docId", title: "Elementor block id", type: "number", readOnly: true, description: "For blocks copied whole from WordPress (e.g. #701)." }),
    defineField({ name: "rootAttrs", type: "string", hidden: true }),
  ],
  preview: { select: { title: "title", docId: "docId" }, prepare: ({ title, docId }) => ({ title, subtitle: docId ? `Elementor block #${docId}` : "Shared section" }) },
});
