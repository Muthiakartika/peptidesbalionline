"use client";

/**
 * Left column of the shop pages: the WooCommerce "Product categories" widget.
 *
 *   * Every category with sub-categories gets a small arrow that opens them (one branch at a time,
 *     Woodmart's "categories accordion"). The branch of the current category starts open.
 *   * Desktop: the widget sticks to the top while the grid scrolls.
 *   * Phones (≤767px): the column becomes a drawer that slides in from the left ("Show sidebar").
 *
 * Styles: ".shop-sidebar" in src/styles/shop.css.
 */
import Link from "next/link";
import { useState } from "react";

import { useChrome } from "@/components/layout/ChromeProvider";
import { Icon } from "@/components/ui/Icon";
import type { CategoryTreeNode } from "@/lib/catalog";

function containsCategory(node: CategoryTreeNode, id: number | undefined): boolean {
  return node.id === id || node.children.some((child) => containsCategory(child, id));
}

function CategoryList({ nodes, currentId, className }: { nodes: CategoryTreeNode[]; currentId?: number; className: string }) {
  // Accordion: at most one open branch per level. The current category's branch starts open.
  const [openId, setOpenId] = useState<number | null>(() => nodes.find((n) => n.children.length > 0 && containsCategory(n, currentId))?.id ?? null);
  return (
    <ul className={className}>
      {nodes.map((node) => {
        const isOpen = openId === node.id;
        return (
          <li
            key={node.id}
            className="shop-cats__item"
            data-current={node.id === currentId || undefined}
            data-current-parent={(node.id !== currentId && containsCategory(node, currentId)) || undefined}
          >
            <Link href={node.path}>{node.name}</Link>
            <span className="shop-cats__count">{node.count}</span>
            {node.children.length > 0 ? (
              <>
                <span
                  className="shop-cats__toggle"
                  data-open={isOpen || undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isOpen ? "Close" : "Open"} ${node.name}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenId(isOpen ? null : node.id);
                    }
                  }}
                >
                  <Icon name="chevronDown" />
                </span>
                {isOpen ? <CategoryList nodes={node.children} currentId={currentId} className="shop-cats__children" /> : null}
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CategorySidebar({ tree, currentId }: { tree: CategoryTreeNode[]; currentId?: number }) {
  const { openPanel, close } = useChrome();
  const isOpen = openPanel === "shopSidebar";
  return (
    <>
      <div className="shop-sidebar" data-open={isOpen}>
        <div className="shop-sidebar__heading">
          <button type="button" className="side-drawer__close" onClick={close}>
            <Icon name="close" />
            Close
          </button>
        </div>
        <div className="shop-sidebar__wrap">
          <div className="shop-widget">
            <h5 className="shop-widget__title">Product categories</h5>
            <CategoryList nodes={tree} currentId={currentId} className="shop-cats" />
          </div>
        </div>
      </div>
      <div className="side-overlay shop-sidebar__overlay" data-open={isOpen} onClick={close} aria-hidden="true" />
    </>
  );
}
