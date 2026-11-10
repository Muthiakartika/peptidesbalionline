import { defineArrayMember, defineField, defineType } from "sanity";

/** The homepage popups (the "5% off" offer and its sign-up form), copied from Elementor Pro. When
 * they open (triggers, timing, how often) is kept from WordPress in "settings". */
export const popup = defineType({
  name: "popup",
  title: "Popup",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Name", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "sections", title: "Sections", type: "array", of: [defineArrayMember({ type: "elSection" })] }),
    defineField({ name: "popupId", title: "Elementor popup id", type: "number", readOnly: true }),
    defineField({ name: "settings", title: "Popup settings (JSON)", type: "text", readOnly: true, rows: 6, description: "Triggers, timing and close behaviour copied from Elementor Pro." }),
    defineField({ name: "rootAttrs", type: "string", hidden: true }),
  ],
  preview: { select: { title: "title", id: "popupId" }, prepare: ({ title, id }) => ({ title, subtitle: `Popup #${id}` }) },
});
