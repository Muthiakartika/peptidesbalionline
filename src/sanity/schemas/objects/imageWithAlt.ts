import { defineField, defineType } from "sanity";

/** An image that always carries alt text (SEO + accessibility). */
export const imageWithAlt = defineType({
  name: "imageWithAlt",
  title: "Image",
  type: "image",
  options: { hotspot: true },
  fields: [
    defineField({
      name: "alt",
      title: "Alt text",
      type: "string",
      description: "Describe the image for Google and screen readers. Copied from WordPress where it existed.",
    }),
    defineField({
      name: "legacyUrl",
      title: "Original WordPress URL",
      type: "url",
      readOnly: true,
      description: "Where this image lived on WordPress. Used to keep old image links working.",
    }),
  ],
});
