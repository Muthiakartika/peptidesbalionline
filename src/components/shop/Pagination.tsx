/**
 * Page numbers under a product grid, like WordPress's paginate_links() with WooCommerce's
 * settings (end_size 3, mid_size 3): page 1 of 9 shows "1 2 3 4 … 7 8 9 →".
 */
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";

type Item = { kind: "page"; page: number } | { kind: "dots" };

export function paginationItems(current: number, total: number, endSize = 3, midSize = 3): Item[] {
  const items: Item[] = [];
  let dots = false;
  for (let n = 1; n <= total; n++) {
    if (n === current || n <= endSize || (n >= current - midSize && n <= current + midSize) || n > total - endSize) {
      items.push({ kind: "page", page: n });
      dots = true;
    } else if (dots) {
      items.push({ kind: "dots" });
      dots = false;
    }
  }
  return items;
}

export function Pagination({ current, total, hrefFor }: { current: number; total: number; hrefFor: (page: number) => string }) {
  if (total <= 1) return null;
  return (
    <div className="shop-pagination-wrap">
      <nav className="shop-pagination" aria-label="Product Pagination">
        <ul>
          {current > 1 ? (
            <li>
              <Link className="shop-pagination__item shop-pagination__arrow" href={hrefFor(current - 1)} aria-label="Previous page">
                <Icon name="chevronLeft" />
              </Link>
            </li>
          ) : null}
          {paginationItems(current, total).map((item, index) =>
            item.kind === "dots" ? (
              <li key={`dots-${index}`}>
                <span className="shop-pagination__item">…</span>
              </li>
            ) : item.page === current ? (
              <li key={item.page}>
                <span className="shop-pagination__item" data-current aria-current="page" aria-label={`Page ${item.page}`}>
                  {item.page}
                </span>
              </li>
            ) : (
              <li key={item.page}>
                <Link className="shop-pagination__item" href={hrefFor(item.page)} aria-label={`Page ${item.page}`}>
                  {item.page}
                </Link>
              </li>
            ),
          )}
          {current < total ? (
            <li>
              <Link className="shop-pagination__item shop-pagination__arrow" href={hrefFor(current + 1)} aria-label="Next page">
                <Icon name="chevronRight" />
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </div>
  );
}
