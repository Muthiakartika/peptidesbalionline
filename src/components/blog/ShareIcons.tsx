/**
 * The theme's share links (Facebook, X, Pinterest, LinkedIn, Telegram), with the addresses the live
 * site builds. The Pinterest description is the title as WordPress escapes it ("&" -> "&#038;"),
 * then URL-encoded like PHP's urlencode (spaces as "+"); without a picture WordPress sends its own
 * default one.
 */
import { siteUrl } from "@/lib/site";

const DEFAULT_IMAGE = "https://peptidesbali.online/wp-includes/images/media/default.svg";

const phpUrlencode = (value: string) =>
  encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");

export function ShareIcons({ path, title, image, className }: { path: string; title?: string; image?: string; className: string }) {
  const url = `${siteUrl}${path}`;
  const pinterest = `https://pinterest.com/pin/create/button/?url=${url}&media=${image ?? DEFAULT_IMAGE}${title ? `&description=${phpUrlencode(title.replace(/&/g, "&#038;"))}` : ""}`;
  const links = [
    { name: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { name: "twitter", label: "X", href: `https://x.com/share?url=${url}` },
    { name: "pinterest", label: "Pinterest", href: pinterest },
    { name: "linkedin", label: "Linkedin", href: `https://www.linkedin.com/shareArticle?mini=true&url=${url}` },
    { name: "tg", label: "Telegram", href: `https://telegram.me/share/url?url=${url}` },
  ];
  return (
    <div className={`wd-social-icons ${className}`}>
      {links.map((link) => (
        <a key={link.name} rel="noopener noreferrer nofollow" href={link.href} target="_blank" className={`wd-social-icon social-${link.name}`} aria-label={`${link.label} social link`}>
          <span className="wd-icon" />
        </a>
      ))}
    </div>
  );
}
