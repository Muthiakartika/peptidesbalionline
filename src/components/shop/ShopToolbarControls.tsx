"use client";

/**
 * The sort dropdown of the shop toolbar: choosing an option loads page 1 sorted that way (no full
 * page reload).
 */
import { useRouter } from "next/navigation";


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
