import Link from "next/link";
import { announcements, type Announcement } from "@/content/site-chrome";

/**
 * The gold scrolling bar above the header. The text is rendered twice so the loop is seamless
 * (same technique as the Woodmart marquee on the live site). Styles: .topbar / .marquee in
 * src/styles/site-chrome.css.
 */
function Track({ items, hidden }: { items: Announcement[]; hidden?: boolean }) {
  return (
    <div className="marquee__track" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <span key={item.text} className="marquee__item">
          {item.text}
          {item.underline ? (
            <>
              {" "}
              <u>{item.underline}</u>☆
            </>
          ) : null}
          {item.href ? (
            item.href.startsWith("http") ? (
              <a href={item.href} rel="nofollow noopener" className="absolute inset-0" aria-label="Marquee item link" tabIndex={hidden ? -1 : undefined} />
            ) : (
              <Link href={item.href} className="absolute inset-0" aria-label="Marquee item link" tabIndex={hidden ? -1 : undefined} />
            )
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** `items`: from Sanity (Site settings → Top bar) when the site reads Sanity, else the copy of live. */
export function TopBar({ items = announcements }: { items?: Announcement[] }) {
  return (
    <div className="topbar">
      <div className="marquee">
        <Track items={items} />
        <Track items={items} hidden />
      </div>
    </div>
  );
}
