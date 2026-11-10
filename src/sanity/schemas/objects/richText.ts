import { defineArrayMember, defineField, defineType } from "sanity";

import { ColorAnnotation, ColorInput } from "../../components/ColorInput";
import { HtmlInput } from "../../components/HtmlInput";
import { KeptFormatting } from "../../components/KeptFormatting";

/**
 * Rich text like Elementor's text editor: paragraph / Heading 1–6 / quote, bold, italic, underline,
 * strikethrough, code, superscript, subscript, links, text colour, bullet and numbered lists,
 * pictures (from the R2 media library) and, for what plain rich text can't hold, HTML.
 *
 * Text converted from WordPress may carry "Original formatting" marks and hidden attributes: they keep
 * the page looking exactly as it did. Leave them be; new text doesn't need them.
 */

const decorators = [
  { title: "Bold", value: "strong" },
  { title: "Italic", value: "em" },
  { title: "Underline", value: "underline" },
  { title: "Strikethrough", value: "strike-through" },
  { title: "Code", value: "code" },
  { title: "Superscript", value: "sup", icon: () => "x²" },
  { title: "Subscript", value: "sub", icon: () => "x₂" },
];

const annotations = [
  defineArrayMember({
    name: "link",
    type: "object",
    title: "Link",
    fields: [
      defineField({
        name: "href",
        title: "Address",
        type: "string",
        description: "A page of this site (/shop/), a full address (https://…), #section, mailto: or tel:.",
        validation: (rule) => rule.required(),
      }),
      defineField({
        name: "target",
        title: "Open in a new tab",
        type: "string",
        options: { list: [{ title: "Same tab", value: "_self" }, { title: "New tab", value: "_blank" }], layout: "radio", direction: "horizontal" },
      }),
      defineField({ name: "rel", title: "rel (advanced)", type: "string", description: 'e.g. "nofollow" for links you don\'t vouch for.' }),
      defineField({ name: "attrs", type: "string", hidden: true }),
    ],
  }),
  defineArrayMember({
    name: "textColor",
    type: "object",
    title: "Text colour",
    icon: () => "A",
    fields: [defineField({ name: "color", title: "Colour", type: "string", components: { input: ColorInput } })],
    components: { annotation: ColorAnnotation },
  }),
  defineArrayMember({
    name: "spanAttrs",
    type: "object",
    title: "Original formatting",
    icon: () => "⌁",
    description: "Formatting copied from WordPress (e.g. a weight or class). Keeps the text looking as it did.",
    fields: [
      defineField({ name: "tag", title: "Element", type: "string", readOnly: true }),
      defineField({ name: "attrs", title: "Attributes", type: "string", readOnly: true }),
    ],
    components: { annotation: KeptFormatting },
  }),
];

const inlineImage = defineArrayMember({
  name: "inlineImage",
  type: "object",
  title: "Picture in the text",
  fields: [
    defineField({ name: "image", title: "Picture", type: "r2Image" }),
    defineField({
      name: "link",
      title: "Link",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: "href", title: "Address", type: "string" }),
        defineField({ name: "target", title: "Target", type: "string", hidden: true }),
        defineField({ name: "rel", title: "rel", type: "string", hidden: true }),
        defineField({ name: "attrs", type: "string", hidden: true }),
      ],
    }),
    defineField({ name: "attrs", type: "string", hidden: true }),
  ],
  preview: { select: { url: "image.url", alt: "image.alt" }, prepare: ({ alt }) => ({ title: alt || "Picture" }) },
});

const inlineHtml = defineArrayMember({
  name: "inlineHtml",
  type: "object",
  title: "HTML in the text",
  fields: [defineField({ name: "html", title: "HTML", type: "text", rows: 3, components: { input: HtmlInput } })],
  preview: { select: { html: "html" }, prepare: ({ html }) => ({ title: "HTML", subtitle: String(html ?? "").slice(0, 60) }) },
});

export const richText = defineType({
  name: "richText",
  title: "Rich text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Paragraph", value: "normal" },
        { title: "Heading 1", value: "h1" },
        { title: "Heading 2", value: "h2" },
        { title: "Heading 3", value: "h3" },
        { title: "Heading 4", value: "h4" },
        { title: "Heading 5", value: "h5" },
        { title: "Heading 6", value: "h6" },
        { title: "Quote", value: "blockquote" },
      ],
      lists: [
        { title: "Bullets", value: "bullet" },
        { title: "Numbers", value: "number" },
      ],
      marks: { decorators, annotations },
      of: [inlineImage, inlineHtml],
    }),
    defineArrayMember({ type: "imageBlock" }),
    defineArrayMember({ type: "htmlBlock" }),
    defineArrayMember({ type: "wrapperBlock" }),
  ],
});

/** One line of rich text (a heading's title, an icon box's description): no paragraphs or lists. */
export const inlineText = defineType({
  name: "inlineText",
  title: "Text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [{ title: "Normal", value: "normal" }],
      lists: [],
      marks: { decorators, annotations },
      of: [inlineHtml],
    }),
  ],
});

export const imageBlock = defineType({
  name: "imageBlock",
  title: "Picture",
  type: "object",
  fields: [defineField({ name: "image", title: "Picture", type: "r2Image" }), defineField({ name: "attrs", type: "string", hidden: true })],
  preview: { select: { alt: "image.alt", url: "image.url" }, prepare: ({ alt, url }) => ({ title: alt || "Picture", subtitle: String(url ?? "").split("/").pop() }) },
});

export const htmlBlock = defineType({
  name: "htmlBlock",
  title: "HTML",
  type: "object",
  description: "Shown exactly as written. Used for what rich text can't hold (tables, forms, embeds).",
  fields: [defineField({ name: "html", title: "HTML", type: "text", rows: 10, components: { input: HtmlInput } })],
  preview: { select: { html: "html" }, prepare: ({ html }) => ({ title: "HTML", subtitle: String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) }) },
});

/** A <div>/<section> box around rich text (copied from WordPress; its classes give it its look). */
export const wrapperBlock = defineType({
  name: "wrapperBlock",
  title: "Box",
  type: "object",
  fields: [
    defineField({ name: "body", title: "Content", type: "richText" }),
    defineField({ name: "tag", title: "Element", type: "string", readOnly: true, initialValue: "div" }),
    defineField({ name: "attrs", type: "string", hidden: true }),
    defineField({ name: "bodyMeta", type: "string", hidden: true }),
  ],
  preview: {
    select: { body: "body" },
    prepare: ({ body }) => ({
      title: "Box",
      subtitle: ((body ?? []) as { children?: { text?: string }[] }[])
        .flatMap((b) => b.children ?? [])
        .map((c) => c.text ?? "")
        .join(" ")
        .slice(0, 80),
    }),
  },
});
