"use client";

/**
 * "On this page": the post's H2 headings as links. On large screens it sits in the sticky column
 * beside the text and marks the section being read; on small screens it is a fold-out list above
 * the text (`compact`).
 */
import { useEffect, useRef, useState } from "react";

import type { ArticleHeading } from "@/lib/blog/article-html";

/** A heading counts as "being read" once its top passes this line (px from the top of the window). */
const READ_LINE = 140;

function useActiveHeading(headings: ArticleHeading[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!headings.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= READ_LINE) current = heading.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);
  return active;
}

export function ArticleToc({ headings, compact = false }: { headings: ArticleHeading[]; compact?: boolean }) {
  const active = useActiveHeading(compact ? [] : headings);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the marked link in view when the list is longer than the column.
  useEffect(() => {
    const list = listRef.current;
    const link = active ? list?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`) : null;
    if (!list || !link) return;
    const top = link.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - link.offsetHeight) list.scrollTop = top - list.clientHeight / 3;
  }, [active]);

  if (headings.length < 2) return null;

  const items = (
    <ol ref={listRef} className="ins-toc__list">
      {headings.map((heading, index) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`} data-id={heading.id} aria-current={active === heading.id ? "location" : undefined}>
            <span className="ins-toc__num" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (compact) {
    return (
      <details className="ins-toc ins-toc--compact">
        <summary>
          <span>On this page</span>
          <span className="ins-toc__count">{headings.length} sections</span>
        </summary>
        {items}
      </details>
    );
  }
  return (
    <nav className="ins-toc" aria-label="On this page">
      <p className="ins-toc__label">On this page</p>
      {items}
    </nav>
  );
}
