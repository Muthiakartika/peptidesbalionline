/**
 * The shapes of the content stored in Sanity (schemas: src/sanity/schemas/). Made by the converter
 * (scripts/sanity/lib/) from the pages copied from WordPress, then edited in Sanity Studio.
 * Fields marked "hidden" are kept by the converter so the page comes out exactly like the original;
 * editors don't see them. Anything an editor adds in the Studio has no hidden fields, and the
 * renderer (./render/) gives it Elementor's standard markup.
 */

/** A picture stored in the Cloudflare R2 bucket (or, until the media move, on the old site). */
export type R2Image = { _type?: "r2Image"; url?: string; alt?: string; width?: number; height?: number };

export type Span = { _type: "span"; _key?: string; text: string; marks?: string[] };

export type LinkMark = { _type: "link"; _key: string; href?: string; target?: string; rel?: string; /** hidden */ attrs?: string };
export type TextColorMark = { _type: "textColor"; _key: string; color?: string };
/** An inline element kept as it was (tag + attributes), e.g. <span style="font-weight: 400;">. */
export type SpanAttrsMark = { _type: "spanAttrs"; _key: string; tag?: string; attrs?: string };
export type MarkDef = LinkMark | TextColorMark | SpanAttrsMark;

export type InlineImage = { _type: "inlineImage"; _key?: string; image?: R2Image; /** hidden */ attrs?: string; link?: { href?: string; target?: string; rel?: string; attrs?: string } };
export type InlineHtml = { _type: "inlineHtml"; _key?: string; html?: string };

export type TextBlock = {
  _type: "block";
  _key?: string;
  style?: string;
  listItem?: "bullet" | "number";
  level?: number;
  markDefs?: MarkDef[];
  children?: (Span | InlineImage | InlineHtml)[];
};
export type HtmlBlock = { _type: "htmlBlock"; _key?: string; html?: string };
export type ImageBlock = { _type: "imageBlock"; _key?: string; image?: R2Image; /** hidden */ attrs?: string };
export type WrapperBlock = { _type: "wrapperBlock"; _key?: string; tag?: string; /** hidden */ attrs?: string; body?: RichText; /** hidden */ bodyMeta?: string };
export type RichText = (TextBlock | HtmlBlock | ImageBlock | WrapperBlock)[];

/** What a block's HTML had besides its text (hidden "bodyMeta", JSON keyed by block _key). */
export type BlockMeta = { attrs?: Record<string, string>; bare?: boolean; list?: { attrs?: Record<string, string> } };

type WidgetBase = { _key?: string; /** hidden: the widget <div>'s attributes (JSON) */ wrapper?: string; /** hidden */ tag?: string; /** hidden: inner HTML with data-cms marks */ template?: string };

export type HeadingWidget = WidgetBase & { _type: "elHeading"; title?: RichText; tag?: string };
export type TextWidget = WidgetBase & { _type: "elText"; body?: RichText; bodyMeta?: string };
export type ButtonWidget = WidgetBase & { _type: "elButton"; label?: string; href?: string; newTab?: boolean; rel?: string };
export type ImageWidget = WidgetBase & { _type: "elImage"; image?: R2Image; href?: string; newTab?: boolean };
export type IconBoxWidget = WidgetBase & { _type: "elIconBox"; title?: string; titleTag?: string; description?: RichText; href?: string; newTab?: boolean };
export type IconListItem = { _type: "elIconListItem"; _key?: string; text?: string; href?: string; newTab?: boolean; /** hidden */ template?: string };
export type IconListWidget = WidgetBase & { _type: "elIconList"; items?: IconListItem[] };
export type AccordionItem = { _type: "elAccordionItem"; _key?: string; title?: string; body?: RichText; bodyMeta?: string; /** hidden */ template?: string };
export type AccordionWidget = WidgetBase & { _type: "elAccordion"; items?: AccordionItem[] };
export type RawWidget = WidgetBase & { _type: "elRaw"; widgetType?: string; html?: string };
export type Widget = HeadingWidget | TextWidget | ButtonWidget | ImageWidget | IconBoxWidget | IconListWidget | AccordionWidget | RawWidget;

export type Slot = { _type: "elSlot"; _key?: string; name?: string; widgets?: Widget[] };
export type Section = { _type: "elSection"; _key?: string; label?: string; hidden?: boolean; /** hidden: HTML with <!--cms-slot:N--> */ layout?: string; slots?: Slot[] };

/** A page's own copy of a shared section's Elementor ids (its CSS is written for them). */
export type SectionSkin = { sections?: { layout?: string; wrappers?: (string | null)[][] }[] };
export type SharedSectionRef = { _type: "sharedSectionRef"; _key?: string; hidden?: boolean; section?: { _ref?: string }; /** hidden JSON */ skin?: string; shared?: SharedSection | null };

export type SharedSection = { _id?: string; title?: string; docId?: number; rootAttrs?: string; sections?: Section[] };

export type ElementorDocument = { rootAttrs?: string; sections?: (Section | SharedSectionRef)[] };
