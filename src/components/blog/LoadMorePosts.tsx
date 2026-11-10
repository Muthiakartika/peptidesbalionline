"use client";

/**
 * The grid of the /insights/ blog widget and its "Load more posts" button: shows `perPage` cards,
 * and `perPage` more on each click; the button goes away when every post is shown, as on the live
 * site.
 */
import { Children, useState, type CSSProperties, type ReactNode } from "react";

export function LoadMorePosts({ gridClass, gridStyle, perPage, loadMore, children }: { gridClass: string; gridStyle: CSSProperties; perPage: number; loadMore: boolean; children: ReactNode }) {
  const cards = Children.toArray(children);
  const [shown, setShown] = useState(perPage);
  const pages = Math.ceil(cards.length / perPage);
  return (
    <>
      <div className={gridClass} style={gridStyle} data-paged={Math.ceil(shown / perPage)} data-source="shortcode">
        {cards.slice(0, shown)}
      </div>
      {loadMore && pages > 1 && shown < cards.length ? (
        <div className="wd-loop-footer blog-footer">
          <a
            href="#"
            rel="nofollow noopener"
            className="btn wd-load-more wd-blog-load-more load-on-click"
            onClick={(event) => {
              event.preventDefault();
              setShown((count) => count + perPage);
            }}
          >
            <span className="load-more-label">Load more posts</span>
          </a>
          <div className="btn wd-load-more wd-load-more-loader">
            <span className="load-more-loading">Loading...</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
