/** Picture addresses: WordPress (and the bucket's r2.dev address) → NEXT_PUBLIC_MEDIA_BASE_URL. */
import { describe, expect, it, vi } from "vitest";

describe("media addresses", () => {
  it("stay as they are while the bucket isn't switched on", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    const { rewriteMediaUrls } = await import("./url");
    const html = '<img src="https://peptidesbali.online/wp-content/uploads/2026/10/a.png">';
    expect(rewriteMediaUrls(html)).toBe(html);
  });

  it("point at the bucket once it is", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://media.example.com/");
    const { mediaUrl, rewriteMediaUrls, withMediaUrls } = await import("./url");
    expect(rewriteMediaUrls('srcset="https://peptidesbali.online/wp-content/uploads/a.png 1x, https://www.peptidesbali.online/wp-content/uploads/b.png 2x"')).toBe(
      'srcset="https://media.example.com/wp-content/uploads/a.png 1x, https://media.example.com/wp-content/uploads/b.png 2x"',
    );
    expect(mediaUrl("https://pub-0123abcd.r2.dev/wp-content/uploads/2026/11/new.jpg")).toBe("https://media.example.com/wp-content/uploads/2026/11/new.jpg");
    expect(mediaUrl("/wp-content/uploads/x.webp")).toBe("https://media.example.com/wp-content/uploads/x.webp");
    // Other addresses of the site are not pictures and stay.
    expect(mediaUrl("https://peptidesbali.online/shop/")).toBe("https://peptidesbali.online/shop/");
    expect(withMediaUrls({ image: { src: "https://peptidesbali.online/wp-content/uploads/c.jpg" } })).toEqual({ image: { src: "https://media.example.com/wp-content/uploads/c.jpg" } });
    vi.unstubAllEnvs();
  });
});
