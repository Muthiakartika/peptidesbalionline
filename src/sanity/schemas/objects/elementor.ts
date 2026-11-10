import { defineArrayMember, defineField, defineType } from "sanity";

import { HtmlInput } from "../../components/HtmlInput";

/**
 * The building blocks of the pages, like Elementor's: a page is a list of sections; a section has one
 * slot per column; a slot holds widgets (heading, text, button, picture, icon box, icon list, FAQ…).
 * Sections and widgets can be added, removed, reordered and duplicated. A section used on several
 * pages is a "shared section": edit it once, every page changes.
 *
 * Hidden fields ("wrapper", "template", "layout") hold Elementor's markup copied from WordPress, so
 * the page's own styles keep applying. A section or widget added here gets Elementor's standard
 * markup and the site's global styles.
 */

const advanced = { name: "advanced", title: "Advanced" };
const hiddenString = (name: string) => defineField({ name, type: "string", hidden: true });
const hiddenText = (name: string) => defineField({ name, type: "text", hidden: true });

const linkFields = [
  defineField({ name: "href", title: "Link", type: "string", description: "A page of this site (/shop/), a full address (https://…), #section, mailto: or tel:." }),
  defineField({ name: "newTab", title: "Open in a new tab", type: "boolean", initialValue: false }),
];

const textOf = (blocks: unknown) =>
  ((blocks ?? []) as { children?: { text?: string }[] }[])
    .flatMap((block) => block.children ?? [])
    .map((child) => child.text ?? "")
    .join("")
    .trim();

export const elHeading = defineType({
  name: "elHeading",
  title: "Heading",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "inlineText", validation: (rule) => rule.required() }),
    defineField({
      name: "tag",
      title: "Heading level",
      type: "string",
      description: "H1 for the page's main title (one per page), H2 for sections, H3–H6 below them. The look comes from the widget's style, not the level.",
      options: {
        list: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span"].map((value) => ({ title: value.toUpperCase(), value })),
        layout: "radio",
        direction: "horizontal",
      },
      initialValue: "h2",
    }),
    hiddenString("wrapper"),
    hiddenText("template"),
  ],
  preview: { select: { title: "title", tag: "tag" }, prepare: ({ title, tag }) => ({ title: textOf(title) || "Heading", subtitle: `Heading ${String(tag ?? "h2").toUpperCase()}` }) },
});

export const elText = defineType({
  name: "elText",
  title: "Text",
  type: "object",
  fields: [defineField({ name: "body", title: "Text", type: "richText" }), hiddenString("bodyMeta"), hiddenString("wrapper"), hiddenText("template")],
  preview: { select: { body: "body" }, prepare: ({ body }) => ({ title: textOf(body).slice(0, 90) || "Text", subtitle: "Text editor" }) },
});

export const elButton = defineType({
  name: "elButton",
  title: "Button",
  type: "object",
  fields: [defineField({ name: "label", title: "Text", type: "string", validation: (rule) => rule.required() }), ...linkFields, defineField({ name: "rel", title: "rel (advanced)", type: "string", hidden: true }), hiddenString("wrapper"), hiddenText("template")],
  preview: { select: { label: "label", href: "href" }, prepare: ({ label, href }) => ({ title: label || "Button", subtitle: `Button → ${href || "(no link)"}` }) },
});

export const elImage = defineType({
  name: "elImage",
  title: "Picture",
  type: "object",
  fields: [defineField({ name: "image", title: "Picture", type: "r2Image" }), ...linkFields, hiddenString("wrapper"), hiddenText("template")],
  preview: { select: { alt: "image.alt", url: "image.url" }, prepare: ({ alt, url }) => ({ title: alt || String(url ?? "").split("/").pop() || "Picture", subtitle: "Picture" }) },
});

export const elIconBox = defineType({
  name: "elIconBox",
  title: "Icon box",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({
      name: "titleTag",
      title: "Title level",
      type: "string",
      options: { list: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span"].map((value) => ({ title: value.toUpperCase(), value })), layout: "radio", direction: "horizontal" },
      initialValue: "h3",
    }),
    defineField({ name: "description", title: "Description", type: "inlineText" }),
    ...linkFields,
    hiddenString("wrapper"),
    hiddenText("template"),
  ],
  preview: { select: { title: "title", description: "description" }, prepare: ({ title, description }) => ({ title: title || "Icon box", subtitle: textOf(description).slice(0, 80) || "Icon box" }) },
});

export const elIconListItem = defineType({
  name: "elIconListItem",
  title: "Item",
  type: "object",
  fields: [defineField({ name: "text", title: "Text", type: "string" }), ...linkFields, hiddenText("template")],
  preview: { select: { title: "text", subtitle: "href" } },
});

export const elIconList = defineType({
  name: "elIconList",
  title: "Icon list",
  type: "object",
  fields: [defineField({ name: "items", title: "Items", type: "array", of: [defineArrayMember({ type: "elIconListItem" })] }), hiddenString("wrapper"), hiddenText("template")],
  preview: { select: { items: "items" }, prepare: ({ items }) => ({ title: ((items ?? []) as { text?: string }[]).map((i) => i.text).join(" · ").slice(0, 90) || "Icon list", subtitle: "Icon list" }) },
});

export const elAccordionItem = defineType({
  name: "elAccordionItem",
  title: "Question",
  type: "object",
  fields: [defineField({ name: "title", title: "Question", type: "string" }), defineField({ name: "body", title: "Answer", type: "richText" }), hiddenString("bodyMeta"), hiddenText("template")],
  preview: { select: { title: "title", body: "body" }, prepare: ({ title, body }) => ({ title: title || "Question", subtitle: textOf(body).slice(0, 80) }) },
});

export const elAccordion = defineType({
  name: "elAccordion",
  title: "FAQ / accordion",
  type: "object",
  fields: [defineField({ name: "items", title: "Questions", type: "array", of: [defineArrayMember({ type: "elAccordionItem" })] }), hiddenString("wrapper"), hiddenText("template")],
  preview: { select: { items: "items" }, prepare: ({ items }) => ({ title: ((items ?? []) as { title?: string }[])[0]?.title ?? "FAQ", subtitle: `FAQ · ${(items ?? []).length} questions` }) },
});

export const elRaw = defineType({
  name: "elRaw",
  title: "HTML widget",
  type: "object",
  description: "An Elementor widget kept as HTML (product grids, forms, counters, carousels, dividers…). Some are filled in by the site itself.",
  fields: [
    defineField({ name: "widgetType", title: "Elementor widget", type: "string", readOnly: true }),
    defineField({ name: "html", title: "HTML", type: "text", rows: 8, components: { input: HtmlInput } }),
    hiddenString("wrapper"),
  ],
  preview: { select: { widgetType: "widgetType", html: "html" }, prepare: ({ widgetType, html }) => ({ title: String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || String(widgetType ?? "HTML"), subtitle: `HTML widget · ${String(widgetType ?? "").replace(".default", "")}` }) },
});

export const widgetTypes = ["elHeading", "elText", "elButton", "elImage", "elIconBox", "elIconList", "elAccordion", "elRaw"];

export const elSlot = defineType({
  name: "elSlot",
  title: "Column",
  type: "object",
  fields: [
    defineField({ name: "name", title: "Column", type: "string", readOnly: true }),
    defineField({ name: "widgets", title: "Widgets", type: "array", of: widgetTypes.map((type) => defineArrayMember({ type })) }),
  ],
  preview: { select: { name: "name", widgets: "widgets" }, prepare: ({ name, widgets }) => ({ title: name || "Column", subtitle: `${(widgets ?? []).length} widgets` }) },
});

export const elSection = defineType({
  name: "elSection",
  title: "Section",
  type: "object",
  groups: [{ name: "content", title: "Content", default: true }, advanced],
  fields: [
    defineField({ name: "label", title: "Name", type: "string", group: "content", description: "Only for finding the section here; not shown on the site." }),
    defineField({ name: "hidden", title: "Hide this section", type: "boolean", group: "content", initialValue: false }),
    defineField({
      name: "slots",
      title: "Columns",
      type: "array",
      group: "content",
      description: "A new section gets one column per item here.",
      of: [defineArrayMember({ type: "elSlot" })],
    }),
    defineField({ name: "layout", title: "Layout (Elementor HTML)", type: "text", group: "advanced", readOnly: true, rows: 4, description: "Copied from WordPress: rows, columns, backgrounds and Elementor's ids. Not editable." }),
  ],
  preview: { select: { label: "label", hidden: "hidden", slots: "slots" }, prepare: ({ label, hidden, slots }) => ({ title: `${hidden ? "(hidden) " : ""}${label || "Section"}`, subtitle: `${(slots ?? []).length} column(s)` }) },
});

/** A shared section placed on a page (edited in "Shared sections"). */
export const sharedSectionRef = defineType({
  name: "sharedSectionRef",
  title: "Shared section",
  type: "object",
  fields: [
    defineField({ name: "section", title: "Shared section", type: "reference", to: [{ type: "sharedSection" }], validation: (rule) => rule.required() }),
    defineField({ name: "hidden", title: "Hide on this page", type: "boolean", initialValue: false }),
    hiddenText("skin"),
  ],
  preview: { select: { title: "section.title", hidden: "hidden" }, prepare: ({ title, hidden }) => ({ title: `${hidden ? "(hidden) " : ""}${title ?? "Shared section"}`, subtitle: "Shared section (edit it once, every page changes)" }) },
});

export const pageSeo = defineType({
  name: "pageSeo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({ name: "title", title: "SEO title", type: "string", description: "The <title> shown in Google (copied from Yoast)." }),
    defineField({ name: "description", title: "Meta description", type: "text", rows: 3, description: "About 150 characters." }),
    defineField({ name: "robots", title: "Robots", type: "string", description: 'Copied from Yoast, e.g. "index, follow, max-image-preview:large…". Use "noindex, follow" to hide the page from Google.' }),
    defineField({ name: "ogTitle", title: "Social title", type: "string" }),
    defineField({ name: "ogDescription", title: "Social description", type: "text", rows: 2 }),
    defineField({ name: "ogType", title: "Social type", type: "string", initialValue: "article" }),
  ],
});

export const elementorObjects = [elHeading, elText, elButton, elImage, elIconBox, elIconListItem, elIconList, elAccordionItem, elAccordion, elRaw, elSlot, elSection, sharedSectionRef, pageSeo];

