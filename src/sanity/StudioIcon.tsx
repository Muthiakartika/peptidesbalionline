/**
 * Workspace icon shown top-left in Sanity Studio (replaces the auto-generated initials).
 * It is the WordPress Site Icon, see public/brand/README.md. Sanity sizes the box (25px in the
 * navbar, 41px in the workspace menu); the image just fills it.
 */
export function StudioIcon() {
  return (
    // A plain <img> on purpose: the Studio is a client-only app, so next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mstile-270x270.png"
      // Decorative: the workspace title is always printed right next to it.
      alt=""
      width={41}
      height={41}
      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
    />
  );
}
