"use client";

/**
 * The two interactive pieces of the shop toolbar:
 *   * the sort dropdown: choosing an option loads page 1 sorted that way (no full page reload);
 *   * "Show sidebar" (tablets and phones): opens the category sidebar.
 */
import { useRouter } from "next/navigation";

import { useChrome } from "@/components/layout/ChromeProvider";

import { archiveHref, type ArchiveParams } from "./shop-url";

export function OrderbySelect({ options, value, basePath, hidden }: { options: { value: string; label: string }[]; value: string; basePath: string; hidden: ArchiveParams }) {
  const router = useRouter();
  return (
    <form
      className="shop-ordering"
      method="get"
      action={basePath}
      onSubmit={(event) => event.preventDefault()}
    >
      <select
        key={value}
        name="orderby"
        className="shop-ordering__select"
        aria-label="Shop order"
        defaultValue={value}
        onChange={(event) => {
          // Same URL the live form submits: the other arguments, the new order and paged=1.
          const href = archiveHref(basePath, 1, hidden, { orderby: event.target.value });
          router.push(`${href}${href.includes("?") ? "&" : "?"}paged=1`);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input type="hidden" name="paged" value="1" />
      {Object.entries(hidden).map(([name, val]) => (val ? <input key={name} type="hidden" name={name} value={val} /> : null))}
    </form>
  );
}

export function SidebarButton() {
  const { open } = useChrome();
  return (
    <div className="shop-sidebar-button">
      <a
        href="#"
        rel="nofollow"
        onClick={(event) => {
          event.preventDefault();
          open("shopSidebar");
        }}
      >
        Show sidebar
      </a>
    </div>
  );
}
