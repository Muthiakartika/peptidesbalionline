/**
 * The title band at the top of /shop/, every category page and the product search results.
 * Redesigned on 12 Nov 2026 at the user's request (the live site's grey band with a narrow title
 * column and a row of round images felt "terlalu kaku"). The user chose design "C · Editorial" out
 * of four options: a soft cream wash, a big Anton title whose last word is gold (like the homepage's
 * "Delivered Across Bali"), small gold breadcrumbs, the product count, a fan of the first three
 * products' pictures, three of the owner's own promises (homepage hero and top bar), and the
 * categories as pill chips in a scrollable row.
 *
 * Which categories the row shows:
 *   - a category with sub-categories: its sub-categories ("Explore Peptide Vials");
 *   - a sub-category: its siblings, itself marked ("More in Peptide Protocols");
 *   - /shop/, search, and top-level categories without sub-categories: the top-level categories.
 *
 * Styles: ".shop-hero", ".shop-rail" and ".shop-card" in src/styles/shop.css.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { getCategories, getListing, getShopCarousel, type Category, type CategoryTile } from "@/lib/catalog";

import { CollectionRail, type RailItem } from "./CollectionRail";

export type Crumb = { label: string; href?: string };

const LAB_RESULTS_PATH = "/lab-results-certificates-of-analysis/";

/** The categories for the card row, with their product counts. */
async function railFor(category: Category | undefined): Promise<{ label: string; items: RailItem[] }> {
  const categories = await getCategories();
  let label = "Shop by category";
  let tiles: CategoryTile[] | undefined;
  if (category && category.carousel.length > 0) {
    label = `Explore ${category.name}`;
    tiles = category.carousel;
  } else if (category) {
    const parent = categories.find((c) => c.id === category.parent && c.id !== category.id);
    if (parent && parent.carousel.length > 0) {
      label = `More in ${parent.name}`;
      tiles = parent.carousel;
    }
  }
  tiles ??= await getShopCarousel();
  const byPath = new Map(categories.map((c) => [c.path, c]));
  return {
    label,
    items: tiles.map((tile) => ({ ...tile, count: byPath.get(tile.path)?.count ?? 0, current: tile.path === category?.path })),
  };
}

/** "Peptide Protocols" → Peptide <gold>Protocols</gold>; one-word titles stay dark. */
function Title({ text }: { text: string }) {
  const split = text.trimEnd().lastIndexOf(" ");
  if (split <= 0)
    return (
      <h1 id="shop-hero-title" className="shop-hero__title">
        {text}
      </h1>
    );
  return (
    <h1 id="shop-hero-title" className="shop-hero__title">
      {text.slice(0, split + 1)}
      <span className="shop-hero__title-accent">{text.slice(split + 1)}</span>
    </h1>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="shop-hero__crumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="shop-hero__crumb">
          {index > 0 ? <span className="shop-hero__crumb-sep" aria-hidden="true" /> : null}
          {crumb.href ? (
            <Link href={crumb.href}>{crumb.label}</Link>
          ) : (
            <span className="shop-hero__crumb-current" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** 1.5px line icons, drawn in currentColor. */
function TrustIcon({ name }: { name: "flask" | "clock" | "box" }) {
  const paths: Record<typeof name, ReactNode> = {
    flask: <path d="M9 3h6M10 3v6.2L4.8 18.4A1.7 1.7 0 0 0 6.3 21h11.4a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3M7.5 15h9" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    box: <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9ZM3.5 7.5 12 12l8.5-4.5M12 12v9" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export async function ShopHero({ title, crumbs, category, search }: { title: string; crumbs: Crumb[]; category?: Category; search?: string }) {
  const [rail, listing] = await Promise.all([railFor(category), getListing({ category, search, perPage: 3 })]);
  const total = listing.total;
  // The first products' pictures, fanned out next to the title.
  const covers = listing.products.map((product) => product.image).slice(0, 3);

  return (
    <section className="shop-hero" aria-labelledby="shop-hero-title">
      <div className="shop-hero__panel">
        <div className="shop-hero__top" data-pictures={covers.length > 0 ? "true" : undefined}>
          <div className="shop-hero__intro">
            <Breadcrumbs crumbs={crumbs} />
            <Title text={title} />
            <p className="shop-hero__meta">
              <span className="shop-hero__count">{total}</span>
              {search !== undefined ? (total === 1 ? "product found" : "products found") : total === 1 ? "product" : "products"}
              {category && category.carousel.length > 0 ? (
                <>
                  <span className="shop-hero__meta-dot" aria-hidden="true" />
                  {category.carousel.length} collections
                </>
              ) : null}
            </p>
          </div>
          {covers.length > 0 ? (
            <div className="shop-hero__collage" data-count={covers.length} aria-hidden="true">
              {covers.map((image, index) => (
                <span key={image.src + index} className="shop-hero__cover" data-n={index}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- product pictures from the live site */}
                  <img src={image.src} srcSet={image.srcset} sizes="(max-width: 767px) 48px, 260px" width={image.width} height={image.height} alt="" decoding="async" />
                </span>
              ))}
            </div>
          ) : null}
          <ul className="shop-hero__trust" aria-label="Why shop with us">
            <li className="shop-hero__trust-item">
              <span className="shop-hero__trust-icon">
                <TrustIcon name="flask" />
              </span>
              <span>
                Verified COAs · <Link href={LAB_RESULTS_PATH}>see lab results</Link>
              </span>
            </li>
            <li className="shop-hero__trust-item">
              <span className="shop-hero__trust-icon">
                <TrustIcon name="clock" />
              </span>
              <span>Same-day Bali dispatch before 5 PM</span>
            </li>
            <li className="shop-hero__trust-item">
              <span className="shop-hero__trust-icon">
                <TrustIcon name="box" />
              </span>
              <span>Discreet packaging</span>
            </li>
          </ul>
        </div>
        {rail.items.length > 0 ? <CollectionRail label={rail.label} items={rail.items} /> : null}
      </div>
    </section>
  );
}
