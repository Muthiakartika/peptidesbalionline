/**
 * The theme's black title band at the top of the blog pages, with breadcrumbs:
 *   a post:     "Blog" (an h3) · Home / <its category>
 *   an archive: the category's name (h1) · Home / Archive by Category "<name>"
 *   a search:   "Search Results for: …" (h1)
 * Styles: src/styles/blog.css.
 */
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type Crumb = { label: string; href?: string };

export function PageTitle({ title, as: Tag = "h1", crumbs, blog = true }: { title: ReactNode; as?: "h1" | "h3"; crumbs?: Crumb[]; blog?: boolean }) {
  return (
    <div className={`wd-page-title page-title page-title-default title-size-default title-design-centered color-scheme-light${blog ? " title-blog" : ""}`}>
      <div className="wd-page-title-bg wd-fill" />
      <div className="container">
        <Tag className="entry-title title">{title}</Tag>
        {crumbs ? (
          <nav className="wd-breadcrumbs">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <span className="wd-delimiter" /> : null}
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span className="wd-last">{crumb.label}</span>}
              </Fragment>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
