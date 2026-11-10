/**
 * The arithmetic the live site's widget scripts do, as plain functions (used by the components in
 * src/components/elementor/ and checked against live values in widgets.test.ts).
 */

/** Owl Carousel: copies of items at each end of a looping carousel (half of max(items in view × 2,
 *  4, the number of items rounded up to an even number)). */
export function owlCloneCount(total: number, maxItemsInView: number, loop: boolean): number {
  if (!loop || total === 0) return 0;
  return Math.max(maxItemsInView * 2, 4, Math.ceil(total / 2) * 2) / 2;
}

/** Trustindex reviews: as many columns as fit at the plugin's review width (at least one). */
export function trustindexColumns(widgetWidth: number, reviewWidth: number): number {
  return Math.max(1, Math.floor(widgetWidth / reviewWidth));
}

/** Trustindex reviews: the progress bar's dot position (% of the bar) for the first review in view. */
export function trustindexDotLeft(index: number, positions: number): number {
  return Math.ceil((index / positions) * 100);
}

type Size = { size?: number | string };
export type GallerySettings = {
  columns?: number;
  columns_tablet?: number;
  columns_mobile?: number;
  gap?: Size;
  gap_tablet?: Size;
  gap_mobile?: Size;
  aspect_ratio?: string; // "1:1", "3:2", …
  lazyload?: string;
};
export type GalleryLayout = { columns: number; gap: number };

/** Elementor gallery: columns and gap per screen size; an empty setting falls back to the next
 *  larger screen size, as in Elementor. */
export function galleryLayouts(settings: GallerySettings): { desktop: GalleryLayout; tablet: GalleryLayout; mobile: GalleryLayout } {
  const desktop = { columns: settings.columns ?? 4, gap: Number(settings.gap?.size ?? 10) };
  const tablet = { columns: settings.columns_tablet ?? desktop.columns, gap: Number(settings.gap_tablet?.size ?? desktop.gap) };
  const mobile = { columns: settings.columns_mobile ?? tablet.columns, gap: Number(settings.gap_mobile?.size ?? tablet.gap) };
  return { desktop, tablet, mobile };
}

/** "3:2" -> 66.6667: a picture's height as % of its width (E-Gallery's --aspect-ratio). */
export function galleryAspectPercent(ratio = "3:2"): number {
  const [w, h] = ratio.split(":").map(Number);
  return w && h ? Number(((h / w) * 100).toFixed(4)) : 66.6667;
}

/** E-Gallery's --container-aspect-ratio: the grid's height as % of its width (4 decimals, then ×100,
 *  which is why the live value reads e.g. "66.32000000000001%"). */
export function galleryContainerRatio(width: number, items: number, layout: GalleryLayout, aspectPercent: number): number {
  const rows = Math.ceil(items / layout.columns);
  const itemHeight = ((width - (layout.columns - 1) * layout.gap) / layout.columns) * (aspectPercent / 100);
  return Number(((rows * itemHeight + (rows - 1) * layout.gap) / width).toFixed(4)) * 100;
}
