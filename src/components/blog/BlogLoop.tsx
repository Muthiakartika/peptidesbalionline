/**
 * A list of post cards and the page links under it, as the theme prints the blog's lists
 * (category archives, search results): two cards per row on desktops and tablets, one on phones.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { blogPageLinks } from "@/lib/blog/pagination";

export function BlogLoop({ children, page, totalPages, hrefFor }: { children: ReactNode; page: number; totalPages: number; hrefFor: (page: number) => string }) {
  const links = blogPageLinks(page, totalPages);
  return (
    <div className="wd-blog-element">
      <div className="wd-posts wd-blog-holder wd-grid-g wd-grid-g" style={{ "--wd-col-lg": "2", "--wd-col-md": "2", "--wd-col-sm": "1", "--wd-gap-lg": "20px", "--wd-gap-sm": "10px" } as CSSProperties} data-paged={page} data-source="main_loop">
        {children}
      </div>
      {links.length ? (
        <div className="wd-loop-footer blog-footer">
          <nav className="wd-pagination">
            <ul>
              {links.map((link) => (
                <li key={`${link.label}-${link.page}`}>
                  {link.current ? (
                    <span className="current page-numbers">{link.label}</span>
                  ) : (
                    <Link className="page-numbers" href={hrefFor(link.page)}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
