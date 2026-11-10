import { defineField, defineType } from "sanity";

import { R2ImageInput } from "../../components/R2ImageInput";

/**
 * A picture stored in the Cloudflare R2 bucket (not in Sanity, to keep the 3,000+ pictures out of
 * Sanity's asset storage). Upload a new file or pick one from the media library; pictures copied from
 * WordPress keep their /wp-content/uploads/… address.
 */
export const r2Image = defineType({
  name: "r2Image",
  title: "Picture",
  type: "object",
  components: { input: R2ImageInput },
  fields: [
    defineField({ name: "url", title: "Address", type: "string", description: "Filled in by Upload / Media library; you can also paste an address." }),
    defineField({ name: "alt", title: "Alt text", type: "string", description: "Describe the picture for Google and screen readers." }),
    defineField({ name: "width", title: "Width (px)", type: "number", readOnly: true }),
    defineField({ name: "height", title: "Height (px)", type: "number", readOnly: true }),
  ],
  preview: {
    select: { url: "url", alt: "alt" },
    prepare: ({ url, alt }) => ({ title: alt || String(url ?? "").split("/").pop() || "Picture", subtitle: url }),
  },
});
