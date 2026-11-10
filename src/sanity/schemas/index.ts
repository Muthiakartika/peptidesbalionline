import { blogCategory, author, post } from "./documents/blog";
import { page } from "./documents/page";
import { popup } from "./documents/popup";
import { product } from "./documents/product";
import { productAttribute } from "./documents/productAttribute";
import { productCategory } from "./documents/productCategory";
import { sharedSection } from "./documents/sharedSection";
import { siteSettings, siteSettingsObjects } from "./documents/siteSettings";
import { elementorObjects } from "./objects/elementor";
import { imageWithAlt } from "./objects/imageWithAlt";
import { legacyHtml } from "./objects/legacyHtml";
import { r2Image } from "./objects/r2Image";
import { dividerBlock, htmlBlock, imageBlock, inlineText, richText, wrapperBlock } from "./objects/richText";
import { seo } from "./objects/seo";

// Every content type editors see in Sanity Studio (/studio).
export const schemaTypes = [
  // reusable building blocks
  seo,
  legacyHtml,
  imageWithAlt,
  r2Image,
  richText,
  inlineText,
  imageBlock,
  dividerBlock,
  htmlBlock,
  wrapperBlock,
  ...elementorObjects,
  ...siteSettingsObjects,
  // documents
  siteSettings,
  page,
  sharedSection,
  popup,
  product,
  productCategory,
  productAttribute,
  post,
  blogCategory,
  author,
];

/** Document types that must exist only once. */
export const singletonTypes = new Set(["siteSettings"]);
