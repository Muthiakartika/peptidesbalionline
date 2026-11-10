import { defineArrayMember, defineField, defineType } from "sanity";

import { StoreAdminLink } from "../../components/StoreAdminLink";

/**
 * Product CONTENT: descriptions, tabs, pictures. Products are created, renamed, archived and deleted in
 * the store admin (/admin/products/), which keeps this document in step; prices, stock, variations,
 * categories and status live there (PostgreSQL), never here (PRD §5 "Important Architecture Rule").
 * So the Studio can't create or delete products (sanity.config.ts) and shows the name and address
 * read-only. The site reads the texts and pictures from here when it reads Sanity.
 */
const fromAdmin = "Changed in the store admin (Products), which keeps it in step here.";

export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({ name: "storeAdmin", title: "Price, stock & status", type: "string", group: "content", readOnly: true, components: { input: StoreAdminLink } }),
    defineField({ name: "name", title: "Product name", type: "string", group: "content", readOnly: true, description: fromAdmin }),
    defineField({ name: "slug", title: "Address", type: "slug", group: "content", readOnly: true, description: `/product/<slug>/. ${fromAdmin}` }),
    defineField({ name: "productType", title: "Type", type: "string", group: "content", readOnly: true, options: { list: ["simple", "variable"] }, hidden: true }),
    defineField({ name: "storeStatus", title: "Status in the shop", type: "string", group: "content", readOnly: true, hidden: true }),
    defineField({ name: "shopId", title: "Product number", type: "number", readOnly: true, hidden: true }),
    defineField({
      name: "images",
      title: "Pictures",
      type: "array",
      group: "content",
      description: "The first picture is the card and main picture, the second shows when the card is hovered, all of them form the gallery. Empty: the pictures copied from WordPress.",
      of: [defineArrayMember({ type: "r2Image" })],
    }),
    defineField({ name: "shortDescription", title: "Short description", type: "richText", group: "content", description: "Next to the pictures, under the price; also in the shop's list view." }),
    defineField({ name: "shortDescriptionMeta", type: "string", hidden: true }),
    defineField({ name: "includedSupplies", title: "Included supplies note", type: "string", group: "content", description: "The cream note under the description, e.g. “10 Needles + 10 Alcohol pads included.”" }),
    defineField({ name: "connectedFormats", title: "“Also available as” box", type: "richText", group: "content" }),
    defineField({ name: "connectedFormatsMeta", type: "string", hidden: true }),
    defineField({
      name: "tabs",
      title: "Tabs (Description, Benefits…)",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "object",
          name: "productTab",
          fields: [
            defineField({ name: "key", title: "Tab id", type: "string", readOnly: true }),
            defineField({ name: "title", title: "Tab title", type: "string" }),
            defineField({ name: "body", title: "Content", type: "richText" }),
            defineField({ name: "bodyMeta", type: "string", hidden: true }),
          ],
          preview: { select: { title: "title", subtitle: "key" } },
        }),
      ],
    }),
    defineField({
      name: "attributes", hidden: true,
      title: "Attributes",
      type: "array",
      
      description: "Which attributes this product uses, and which of their values (in display order).",
      of: [
        defineArrayMember({
          type: "object",
          name: "productAttributeUse",
          fields: [
            defineField({ name: "attribute", title: "Attribute", type: "reference", to: [{ type: "productAttribute" }], validation: (rule) => rule.required() }),
            defineField({ name: "values", title: "Values used", type: "array", of: [defineArrayMember({ type: "string" })] }),
            defineField({ name: "usedForVariations", title: "Used for variations", type: "boolean", initialValue: true }),
          ],
          preview: { select: { title: "attribute.name", values: "values" }, prepare: ({ title, values }) => ({ title, subtitle: (values ?? []).join(", ") }) },
        }),
      ],
    }),
    defineField({
      name: "variants", hidden: true,
      title: "Variants",
      type: "array",
      
      description: "Labels and images of each variant. Prices and stock are edited in the store admin, not here.",
      of: [
        defineArrayMember({
          type: "object",
          name: "variant",
          fields: [
            defineField({ name: "variantKey", title: "Variant key", type: "string", readOnly: true, description: "Links this variant to its price and stock in the store database." }),
            defineField({ name: "label", title: "Label", type: "string", description: "e.g. Disposable Pen / 10 MG" }),
            defineField({ name: "image", title: "Image", type: "imageWithAlt" }),
            defineField({ name: "legacyWooVariationId", title: "WooCommerce variation ID", type: "number", readOnly: true }),
          ],
          preview: { select: { title: "label", subtitle: "variantKey", media: "image" } },
        }),
      ],
    }),
    defineField({
      name: "coaDocuments", hidden: true,
      title: "Certificates of analysis",
      type: "array",
      
      of: [
        defineArrayMember({
          type: "object",
          name: "coa",
          fields: [
            defineField({ name: "title", title: "Title", type: "string", description: "e.g. BPC-157 10mg batch 2609" }),
            defineField({ name: "file", title: "PDF", type: "file", options: { accept: "application/pdf" } }),
            defineField({ name: "verifyUrl", title: "Verification link", type: "url", description: "e.g. the verify.janoshik.com test page" }),
          ],
        }),
      ],
    }),
    defineField({
      name: "faqs", hidden: true,
      title: "FAQs",
      type: "array",
      
      of: [
        defineArrayMember({
          type: "object",
          name: "faq",
          fields: [
            defineField({ name: "question", title: "Question", type: "string" }),
            defineField({ name: "answer", title: "Answer", type: "text", rows: 4 }),
          ],
          preview: { select: { title: "question" } },
        }),
      ],
    }),
    defineField({ name: "relatedProducts", hidden: true, title: "Related products", type: "array",  of: [defineArrayMember({ type: "reference", to: [{ type: "product" }] })] }),
    defineField({ name: "featured", hidden: true, title: "Featured", type: "boolean", group: "content", initialValue: false }),
    defineField({
      name: "visibility", hidden: true,
      title: "Catalogue visibility",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "Shop and search results", value: "visible" },
          { title: "Shop only", value: "catalog" },
          { title: "Search results only", value: "search" },
          { title: "Hidden", value: "hidden" },
        ],
      },
      initialValue: "visible",
    }),
    defineField({ name: "legacyWooId", title: "WooCommerce ID", type: "number", readOnly: true, hidden: true }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  preview: {
    select: { title: "name", slug: "slug.current", status: "storeStatus" },
    prepare: ({ title, slug, status }) => ({ title, subtitle: `${status === "archived" ? "(archived) " : status && status !== "publish" ? `(${status}) ` : ""}/product/${slug ?? ""}/` }),
  },
});
