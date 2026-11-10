/**
 * Content copied from WordPress (product descriptions, Elementor blocks) is stored as the HTML the
 * live page printed. Before showing it we undo three things that only made sense on WordPress:
 *
 *   1. Lazy images: LiteSpeed prints a grey SVG placeholder in `src` and the real file in
 *      `data-src` / `data-srcset` / `data-sizes`, then swaps them with JavaScript. We put the real
 *      values back (the browser's own `loading="lazy"` does the lazy part).
 *   2. `<noscript>` copies of those images (they would show twice) and any `<script>`.
 *   3. Absolute links (and form targets) to pages of the live site become relative, so they stay
 *      on this site. Lazy iframes get their real address back too.
 *      Image files (/wp-content/uploads/…) keep their absolute address; once they are copied to the
 *      Cloudflare R2 bucket and NEXT_PUBLIC_MEDIA_BASE_URL is set, they point at the bucket instead
 *      (src/lib/media/url.ts, docs/setup/r2.md).
 */
import { rewriteMediaUrls } from "@/lib/media/url";

const SITE = "https://peptidesbali.online";

export function cleanLegacyHtml(html: string | null | undefined): string {
  if (!html) return "";
  return rewriteMediaUrls(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<noscript>[\s\S]*?<\/noscript>/gi, "")
      // Lazy images: drop the placeholder, promote data-* to the real attributes.
      .replace(/<img\b[^>]*>/gi, (tag) => {
        if (!/\bdata-(src|srcset)=/.test(tag)) return tag;
        let out = tag.replace(/\ssrc="data:image[^"]*"/i, "").replace(/\sdata-lazyloaded="[^"]*"/i, "");
        out = out.replace(/\sdata-src=/i, " src=").replace(/\sdata-srcset=/i, " srcset=").replace(/\sdata-sizes=/i, " sizes=");
        return out.includes(" loading=") ? out : out.replace(/^<img/i, '<img loading="lazy"');
      })
      // Lazy iframes (the Google map): same swap as the images.
      .replace(/<iframe\b[^>]*>/gi, (tag) => {
        if (!/\bdata-src=/.test(tag)) return tag;
        return tag.replace(/\ssrc="about:blank"/i, "").replace(/\sdata-lazyloaded="[^"]*"/i, "").replace(/\sdata-src=/i, " src=");
      })
      // Links and form targets on the live site → this site (but keep uploaded files on the old domain).
      .replace(/(href|action)="https?:\/\/peptidesbali\.online(\/(?!wp-content\/)[^"]*)?"/gi, (_match, attribute: string, path: string | undefined) => `${attribute}="${path ?? "/"}"`)
      .replace(new RegExp(`href="${SITE}"`, "g"), 'href="/"'),
  );
}
