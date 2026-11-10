"use client";

/**
 * Desktop main menu with hover dropdowns (pure CSS: .has-dropdown:hover > .dropdown).
 * It's a Client Component only so it can underline the menu item of the current page,
 * like WordPress's "current-menu-item" class does.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainMenu, type NavLink } from "@/content/site-chrome";
import { Icon } from "@/components/ui/Icon";

function isActive(item: NavLink, pathname: string): boolean {
  return item.href === pathname || Boolean(item.children?.some((child) => isActive(child, pathname)));
}

function DropdownItems({ items }: { items: NavLink[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.href} className={`dropdown__item ${item.children ? "has-dropdown" : ""}`}>
          <Link href={item.href} className="dropdown__link">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- 18px thumbnails, same files as the live menu
              <img src={item.image} alt={item.label} width={150} height={150} className="dropdown__img" loading="lazy" />
            ) : null}
            {item.label}
            {item.children ? <Icon name="chevronRight" className="dropdown__chevron" /> : null}
          </Link>
          {item.children ? (
            <div className="dropdown dropdown--nested">
              <DropdownItems items={item.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MainNav({ menu = mainMenu }: { menu?: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      <ul className="main-nav">
        {menu.map((item) => (
          <li key={item.href} className={`main-nav__item ${item.children ? "has-dropdown" : ""}`} data-active={isActive(item, pathname) || undefined}>
            <Link href={item.href} className="main-nav__link">
              <span className="main-nav__text">{item.label}</span>
              {item.children ? <Icon name="chevronDown" className="main-nav__arrow" /> : null}
            </Link>
            {item.children ? (
              <div className="dropdown">
                <DropdownItems items={item.children} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
