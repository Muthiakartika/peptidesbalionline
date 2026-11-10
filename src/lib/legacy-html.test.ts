/** cleanLegacyHtml: what is undone in the HTML copied from WordPress. */
import { describe, expect, it } from "vitest";

import { cleanLegacyHtml } from "./legacy-html";

describe("cleanLegacyHtml", () => {
  it("gives lazy images their real address back and drops scripts and noscript copies", () => {
    const html = '<img src="data:image/svg+xml;base64,AA" data-lazyloaded="1" data-src="/a.webp" data-srcset="/a.webp 1x" width="10"><noscript><img src="/a.webp"></noscript><script>x()</script>';
    expect(cleanLegacyHtml(html)).toBe('<img loading="lazy" src="/a.webp" srcset="/a.webp 1x" width="10">');
  });
  it("gives the lazy Google map its address back", () => {
    expect(cleanLegacyHtml('<iframe data-lazyloaded="1" data-src="https://www.google.com/maps/embed?pb=1" src="about:blank" height="450"></iframe>')).toBe(
      '<iframe src="https://www.google.com/maps/embed?pb=1" height="450"></iframe>',
    );
  });
  it("keeps visitors on this site but uploaded files on the old domain", () => {
    expect(cleanLegacyHtml('<a href="https://peptidesbali.online/shop/">x</a>')).toBe('<a href="/shop/">x</a>');
    expect(cleanLegacyHtml('<form action="https://peptidesbali.online"></form>')).toBe('<form action="/"></form>');
    expect(cleanLegacyHtml('<a href="https://peptidesbali.online/wp-content/uploads/a.pdf">x</a>')).toBe('<a href="https://peptidesbali.online/wp-content/uploads/a.pdf">x</a>');
  });
});
