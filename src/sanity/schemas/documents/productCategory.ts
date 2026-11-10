import { defineField, defineType } from "sanity";

export const productCategory = defineType({
  name: "productCategory",
  title: "Product category",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      description: "Part of the URL: /product-category/<parent slug>/<this slug>/. Must match WordPress.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "parent",
      title: "Parent category",
      type: "reference",
      to: [{ type: "productCategory" }],
      description: "e.g. 'Healing & Recovery' sits under 'Peptide Vials'.",
    }),
    defineField({ name: "image", title: "Image", type: "imageWithAlt" }),
    defineField({ name: "description", title: "Description", type: "legacyHtml" }),
    defineField({
      name: "displayOrder",
      title: "Display order",
      type: "number",
      description: "Lower numbers show first.",
      initialValue: 0,
    }),
    defineField({ name: "legacyWooId", title: "WooCommerce ID", type: "number", readOnly: true }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  orderings: [{ title: "Display order", name: "displayOrder", by: [{ field: "displayOrder", direction: "asc" }] }],
  preview: { select: { title: "name", subtitle: "parent.name", media: "image" } },
});
