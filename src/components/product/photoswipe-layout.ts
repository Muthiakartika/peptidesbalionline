/**
 * Where PhotoSwipe puts the picture (used by PhotoSwipe.tsx; checked in photoswipe-layout.test.ts).
 *
 *   "fit": the whole picture between the bars (44px at the top and bottom, none on small touch
 *          screens), centred, never enlarged beyond its own size;
 *   zoomed: full size, moved by dragging, but never leaving empty space at an edge (a picture
 *          smaller than the screen stays centred).
 */
export type Box = { x: number; y: number; width: number; height: number };
export type View = { width: number; height: number; bar: number };

export function placement(size: { width: number; height: number }, view: View, zoomed: boolean, pan: { x: number; y: number }): Box {
  if (!zoomed) {
    const fit = Math.min(1, view.width / size.width, (view.height - 2 * view.bar) / size.height);
    const width = size.width * fit;
    const height = size.height * fit;
    return { x: (view.width - width) / 2, y: view.bar + (view.height - 2 * view.bar - height) / 2, width, height };
  }
  return { x: clamp(pan.x, view.width, size.width), y: clamp(pan.y, view.height, size.height), width: size.width, height: size.height };
}

/** Keeps a zoomed picture covering the screen (or centred when it is smaller than the screen). */
export function clamp(position: number, viewSize: number, size: number): number {
  if (size <= viewSize) return (viewSize - size) / 2;
  return Math.min(0, Math.max(viewSize - size, position));
}
