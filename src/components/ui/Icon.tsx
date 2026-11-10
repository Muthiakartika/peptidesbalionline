/**
 * Icons from the live site's icon font (Woodmart "woodmart-font"). Each name maps to the exact
 * character code the live site uses, measured with the browser on 3 Nov 2026.
 *
 *   <Icon name="cart" className="text-[20px]" />
 */
const GLYPHS = {
  search: "",
  close: "",
  account: "",
  cart: "",
  menu: "",
  chevronDown: "",
  chevronRight: "",
  emptyCart: "",
  // Shop pages (measured 4 Nov 2026)
  chevronLeft: "",
  viewList: "",
  viewGrid3: "",
  viewGrid4: "",
  sort: "",
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={`font-icons inline-block leading-none not-italic ${className}`}>
      {GLYPHS[name]}
    </span>
  );
}
