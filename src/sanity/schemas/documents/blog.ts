import { defineArrayMember, defineField, defineType } from "sanity";

export const author = defineType({
  name: "author",
  title: "Blog author",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Public name",
      type: "string",
      description: "Shown on every post. Never use an e-mail address here (it is public).",
      validation: (rule) => rule.required().custom((value) => (value && value.includes("@") ? "Don't use an e-mail address as a public name" : true)),
    }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "name" } }),
    defineField({ name: "image", title: "Photo", type: "imageWithAlt" }),
  ],
});

export const blogCategory = defineType({
  name: "blogCategory",
  title: "Blog category",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "name" }, description: "URL: /category/<slug>/", validation: (rule) => rule.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "legacyWpId", title: "WordPress ID", type: "number", readOnly: true }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
});

export const post = defineType({
  name: "post",
  title: "Blog post",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      description: "Posts live at the root of the site: /<slug>/. Must stay identical to WordPress.",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "author", title: "Author", type: "reference", to: [{ type: "author" }] }),
    defineField({ name: "publishedAt", title: "Published", type: "datetime", validation: (rule) => rule.required() }),
    defineField({ name: "featuredImage", title: "Featured image", type: "imageWithAlt" }),
    defineField({
      name: "body",
      title: "Body",
      type: "richText",
      description: "The post text (converted from WordPress). The site shows it when it reads Sanity; the title, dates, categories, picture and SEO still come from the WordPress copy for now.",
    }),
    defineField({ name: "bodyMeta", type: "string", hidden: true }),
    defineField({ name: "categories", title: "Categories", type: "array", of: [defineArrayMember({ type: "reference", to: [{ type: "blogCategory" }] })] }),
    defineField({ name: "tags", title: "Tags", type: "array", of: [defineArrayMember({ type: "string" })], options: { layout: "tags" } }),
    defineField({ name: "relatedPosts", title: "Related posts", type: "array", of: [defineArrayMember({ type: "reference", to: [{ type: "post" }] })] }),
    defineField({ name: "legacyWpId", title: "WordPress ID", type: "number", readOnly: true }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  orderings: [{ title: "Newest first", name: "publishedDesc", by: [{ field: "publishedAt", direction: "desc" }] }],
  preview: { select: { title: "title", subtitle: "slug.current", media: "featuredImage" } },
});
