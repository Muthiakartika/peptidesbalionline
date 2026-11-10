import { defineArrayMember, defineField, defineType } from "sanity";

/** Global attributes such as MG, Pen Type, IU, Storage (WooCommerce "pa_*" taxonomies). */
export const productAttribute = defineType({
  name: "productAttribute",
  title: "Product attribute",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", description: "e.g. MG, Pen Type", validation: (rule) => rule.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      description: "WooCommerce taxonomy without 'pa_', e.g. 'mg', 'pen-type'.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "display",
      title: "How customers pick a value",
      type: "string",
      options: {
        list: [
          { title: "Buttons (pills)", value: "pills" },
          { title: "Dropdown", value: "select" },
        ],
        layout: "radio",
      },
      initialValue: "pills",
    }),
    defineField({
      name: "terms",
      title: "Values (in display order)",
      type: "array",
      description: "Drag to reorder. The order here is the order on the product page.",
      of: [
        defineArrayMember({
          type: "object",
          name: "term",
          fields: [
            defineField({ name: "name", title: "Label", type: "string", description: "e.g. 5 MG", validation: (rule) => rule.required() }),
            defineField({ name: "slug", title: "Slug", type: "string", description: "e.g. 5", validation: (rule) => rule.required() }),
          ],
          preview: { select: { title: "name", subtitle: "slug" } },
        }),
      ],
    }),
  ],
});
