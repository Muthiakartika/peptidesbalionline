import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * One document for what every page shows: the gold top bar, the main menu (desktop and mobile), the
 * footer, the cookie bar and the homepage's age gate. Filled from src/content/site-chrome.ts by the
 * import; the site reads it in src/lib/content/site-chrome.ts (anything left empty here falls back to
 * that file). Keep the field names in sync with the types there.
 */

const navLink = defineType({
  name: "navLink",
  title: "Menu item",
  type: "object",
  fields: [
    defineField({ name: "label", title: "Label", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "href", title: "Link", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "image", title: "Picture (mega menu)", type: "string", description: "Only for the items of the big dropdown, e.g. /images/nav/peptide-vials.webp." }),
    defineField({ name: "children", title: "Sub-items", type: "array", of: [defineArrayMember({ type: "navLink" })] }),
  ],
  preview: { select: { title: "label", subtitle: "href" } },
});

const footerLink = defineArrayMember({
  type: "object",
  name: "footerLink",
  fields: [defineField({ name: "label", title: "Label", type: "string" }), defineField({ name: "href", title: "Link", type: "string", description: "Empty = plain text (like “Home” on the live site)." })],
  preview: { select: { title: "label", subtitle: "href" } },
});

const footerColumn = defineType({
  name: "footerColumn",
  title: "Footer column",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({ name: "headingTag", title: "Heading level", type: "string", options: { list: ["h2", "h4"], layout: "radio", direction: "horizontal" }, initialValue: "h4" }),
    defineField({ name: "uppercase", title: "Upper case", type: "boolean", initialValue: true }),
    defineField({ name: "links", title: "Links", type: "array", of: [footerLink] }),
  ],
  preview: { select: { title: "heading" } },
});

export const siteSettingsObjects = [navLink, footerColumn];

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  groups: [
    { name: "header", title: "Top bar & menu", default: true },
    { name: "footer", title: "Footer" },
    { name: "notices", title: "Age gate & cookies" },
  ],
  fields: [
    defineField({
      name: "announcements",
      title: "Top bar messages",
      type: "array",
      group: "header",
      description: "The scrolling gold bar at the top of every page.",
      of: [
        defineArrayMember({
          type: "object",
          name: "announcement",
          fields: [
            defineField({ name: "text", title: "Text", type: "string", validation: (rule) => rule.required() }),
            defineField({ name: "underline", title: "Underlined words after it", type: "string", description: "e.g. Shop bundles (optional)" }),
            defineField({ name: "href", title: "Link", type: "string", description: "The whole message becomes this link (optional)." }),
          ],
          preview: { select: { title: "text", subtitle: "href" } },
        }),
      ],
    }),
    defineField({ name: "mainMenu", title: "Main menu", type: "array", group: "header", description: "The desktop menu and the mobile menu.", of: [defineArrayMember({ type: "navLink" })] }),
    defineField({
      name: "footer",
      title: "Footer",
      type: "object",
      group: "footer",
      fields: [
        defineField({ name: "intro", title: "Text under the logo", type: "text", rows: 2 }),
        defineField({ name: "topColumns", title: "Top columns (Navigation, Legal)", type: "array", of: [defineArrayMember({ type: "footerColumn" })], validation: (rule) => rule.length(2) }),
        defineField({
          name: "contact",
          title: "Contact",
          type: "object",
          fields: [
            defineField({ name: "heading", title: "Heading", type: "string" }),
            defineField({ name: "email", title: "E-mail", type: "string" }),
            defineField({ name: "address", title: "Address", type: "text", rows: 2 }),
          ],
        }),
        defineField({ name: "linkColumns", title: "Link columns (Bali, Nationwide, Pricing)", type: "array", of: [defineArrayMember({ type: "footerColumn" })], validation: (rule) => rule.length(3) }),
        defineField({ name: "paymentLabel", title: "Payment methods heading", type: "string" }),
        defineField({ name: "paymentMethods", title: "Payment methods", type: "array", of: [defineArrayMember({ type: "string" })] }),
        defineField({ name: "disclaimer", title: "Disclaimer", type: "text", rows: 3 }),
        defineField({ name: "copyright", title: "Copyright line", type: "string" }),
      ],
    }),
    defineField({
      name: "ageGate",
      title: "Age gate (homepage)",
      type: "object",
      group: "notices",
      fields: [
        defineField({ name: "eyebrow", title: "Small text above the title", type: "string" }),
        defineField({ name: "title", title: "Title (one item per line)", type: "array", of: [defineArrayMember({ type: "string" })], validation: (rule) => rule.max(3) }),
        defineField({ name: "englishBefore", title: "English text, before the brand", type: "text", rows: 2 }),
        defineField({ name: "englishBrand", title: "Brand (bold)", type: "string" }),
        defineField({ name: "englishAfter", title: "English text, after the brand", type: "text", rows: 3 }),
        defineField({ name: "indonesian", title: "Indonesian text", type: "text", rows: 3 }),
        defineField({ name: "enterLabel", title: "Enter button", type: "string" }),
        defineField({ name: "backLabel", title: "Back button", type: "string" }),
        defineField({ name: "footnote", title: "Note under the buttons", type: "text", rows: 2 }),
      ],
    }),
    defineField({
      name: "cookieNotice",
      title: "Cookie bar",
      type: "object",
      group: "notices",
      fields: [defineField({ name: "text", title: "Text", type: "text", rows: 2 }), defineField({ name: "button", title: "Button", type: "string" })],
    }),
  ],
  preview: { prepare: () => ({ title: "Site settings" }) },
});
