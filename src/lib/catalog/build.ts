/**
 * The shop's catalogue from the store database (product_records / product_variants / inventory,
 * edited in /admin/products/) over the snapshot of the live shop (src/content/catalog.json and
 * product-pages.json), which still provides what the database doesn't hold: pictures, card and page
 * layout data, SEO tags. Pure functions (no I/O), so the tests can check that the catalogue built from
 * the imported rows is the snapshot itself.
 *
 *   * a product shows in the shop only when its status is "publish"; draft, private and archived ones
 *     disappear from listings, search and their address (404);
 *   * prices: the sale price while its dates allow, else the regular price (WooCommerce's rule);
 *   * stock: "out of stock", or managed stock at 0 without backorders, can't be bought; "on backorder"
 *     (or managed stock at 0 with backorders allowed) can, with WooCommerce's notice;
 *   * pictures: the ones chosen in Sanity (product → Images), else the snapshot's;
 *   * a product made in the admin (not in the snapshot) gets its card and page from the database,
 *     Sanity's pictures, and the shop's usual page parts;
 *   * categories (/admin/categories/): names, addresses (the parents' slugs), carousels and headings
 *     from the database; a renamed or moved category is renamed on every card, breadcrumb and page;
 *     how many products a category has is counted from the published products (sub-categories
 *     included, as WooCommerce counts);
 *   * shop-wide attributes (/admin/attributes/): a product's attribute_pa_* shows the attribute's
 *     current name, display and value names, in the attribute's value order.
 */
import type { AttributeTerm, CatalogPicture, CategorySeo, ProductAttribute, VariantImage } from "@/db/schema/catalog";

import type { GalleryImage, ProductForm, ProductPageData } from "./product-page";
import type { CatalogImage, Category, CategoryTile, Product, QuickShopAttribute, SortKey, Variation } from "./types";

export type DbVariantRow = {
  shopId: number | null;
  variantKey: string;
  attributes: Record<string, string>;
  image: VariantImage | null;
  regularPriceMinor: bigint;
  salePriceMinor: bigint | null;
  saleFrom: Date | null;
  saleTo: Date | null;
  status: string;
  sortOrder: number;
  manageStock: boolean;
  stockQuantity: number | null;
  stockStatus: "instock" | "outofstock" | "onbackorder";
  backorders: "no" | "notify" | "yes";
};

export type DbProductRow = {
  shopId: number;
  sanityId: string;
  slug: string;
  name: string;
  type: "simple" | "variable";
  status: string;
  categorySlugs: string[];
  menuOrder: number;
  publishedAt: Date | null;
  attributes: ProductAttribute[];
  variants: DbVariantRow[];
};

/** Pictures chosen in Sanity for a product (by Sanity document id). */
export type ProductMedia = Record<string, { url: string; alt?: string; width?: number; height?: number }[]>;

export type DbCategoryRow = {
  id: number;
  slug: string;
  name: string;
  parentId: number;
  title: string;
  sortOrder: number;
  tileImage: CatalogPicture | null;
  searchImage: CatalogPicture | null;
  seo: CategorySeo;
};

export type DbAttributeRow = { slug: string; label: string; swatches: boolean; terms: AttributeTerm[] };

/** The categories and shop-wide attributes in the database (empty: the snapshot's categories). */
export type Taxonomy = { categories: DbCategoryRow[]; attributes: DbAttributeRow[] };

export type CatalogBase = { products: Product[]; pages: ProductPageData[]; categories: Category[]; shopCarousel: CategoryTile[] };

export type BuiltCatalog = {
  products: Product[];
  pages: ProductPageData[];
  /** Products and variations on backorder, by shop number: { notify } = "Allow, but notify customer". */
  backorder: Record<string, { notify: boolean }>;
  /** Every category, by name (as WordPress lists them), with its product count. */
  categories: Category[];
  /** The round pictures on /shop/: the top-level categories in their order. */
  shopCarousel: CategoryTile[];
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/**
 * The categories as the shop shows them, from the database rows (counts are filled in by
 * withProductCounts). A category whose parent doesn't exist is shown at the top level.
 */
export function categoriesFrom(rows: DbCategoryRow[]): { categories: Category[]; shopCarousel: CategoryTile[] } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parentOf = (row: DbCategoryRow) => (row.parentId !== row.id && byId.has(row.parentId) ? row.parentId : 0);
  const pathOf = (row: DbCategoryRow) => {
    const slugs: string[] = [];
    const seen = new Set<number>();
    for (let r: DbCategoryRow | undefined = row; r && !seen.has(r.id); r = parentOf(r) ? byId.get(parentOf(r)) : undefined) {
      seen.add(r.id);
      slugs.unshift(r.slug);
    }
    return `/product-category/${slugs.join("/")}/`;
  };
  const paths = new Map(rows.map((r) => [r.id, pathOf(r)]));
  const tile = (r: DbCategoryRow): CategoryTile => ({ path: paths.get(r.id)!, name: r.name, image: r.tileImage ?? { src: PLACEHOLDER, width: 300, height: 300, alt: r.name } });
  const childrenOf = (id: number) => rows.filter((r) => parentOf(r) === id).sort((a, b) => a.sortOrder - b.sortOrder || byName(a, b));
  const categories: Category[] = rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      parent: parentOf(r),
      count: 0,
      path: paths.get(r.id)!,
      title: r.title,
      seo: r.seo,
      searchImage: r.searchImage ?? null,
      carousel: childrenOf(r.id).map(tile),
    }))
    .sort(byName);
  return { categories, shopCarousel: childrenOf(0).map(tile) };
}

/** The category and every category below it, as slugs (WooCommerce lists and counts sub-category products too). */
export function familySlugs(category: Category, categories: Category[]): Set<string> {
  const ids = new Set([category.id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of categories) {
      if (!ids.has(c.id) && ids.has(c.parent)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return new Set(categories.filter((c) => ids.has(c.id)).map((c) => c.slug));
}

/** The categories with how many of these (published) products each lists. */
function withProductCounts(categories: Category[], products: { categories: string[] }[]): Category[] {
  return categories.map((c) => {
    const family = familySlugs(c, categories);
    return { ...c, count: products.filter((p) => p.categories.some((slug) => family.has(slug))).length };
  });
}

/** A product's attributes with the shop-wide ones' current name, display, value names and value order. */
function withShopAttributes(list: ProductAttribute[], shop: Map<string, DbAttributeRow>): ProductAttribute[] {
  return list.map((attribute) => {
    const global = shop.get(attribute.name);
    if (!global) return attribute;
    const position = new Map(global.terms.map((t, i) => [t.value, i]));
    const label = new Map(global.terms.map((t) => [t.value, t.label]));
    const options = attribute.options
      .map((o) => ({ value: o.value, label: label.get(o.value) ?? o.label }))
      .sort((a, b) => (position.get(a.value) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.value) ?? Number.MAX_SAFE_INTEGER));
    return { ...attribute, label: global.label, swatches: global.swatches, options };
  });
}

/** The Elementor CSS a product page links when the snapshot has no page for it (the shop's usual set). */
const DEFAULT_PAGE_STYLES = (pages: ProductPageData[]) => {
  const counts = new Map<string, { styles: number[]; n: number }>();
  for (const page of pages) {
    const key = page.elementorStyles.join(",");
    const entry = counts.get(key) ?? { styles: page.elementorStyles, n: 0 };
    entry.n++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.styles ?? [];
};

/** The price a variant sells for right now. */
export function currentPrice(variant: Pick<DbVariantRow, "regularPriceMinor" | "salePriceMinor" | "saleFrom" | "saleTo">, now: Date): bigint {
  const saleOn = variant.salePriceMinor !== null && (!variant.saleFrom || variant.saleFrom <= now) && (!variant.saleTo || variant.saleTo > now);
  return saleOn ? variant.salePriceMinor! : variant.regularPriceMinor;
}

const outOfManagedStock = (v: DbVariantRow) => v.manageStock && (v.stockQuantity ?? 0) <= 0;

/** Can be put in the cart. */
export function isAvailable(v: DbVariantRow): boolean {
  if (v.stockStatus === "outofstock") return false;
  return !(outOfManagedStock(v) && v.backorders === "no");
}

/** On backorder: { notify } (WooCommerce's "Available on backorder" notice), or null. */
export function backorderOf(v: DbVariantRow): { notify: boolean } | null {
  if (!isAvailable(v)) return null;
  if (v.stockStatus === "onbackorder" || outOfManagedStock(v)) return { notify: v.backorders !== "yes" };
  return null;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A gallery picture as a thumbnail (without its tooltip and zoom file). */
const thumbnail = (image: GalleryImage): CatalogImage => ({ src: image.src, width: image.width, height: image.height, alt: image.alt, ...(image.srcset ? { srcset: image.srcset } : {}), ...(image.sizes ? { sizes: image.sizes } : {}) });

/** The picture of a product that has none yet (add pictures in Sanity → Products → Images). */
export const PLACEHOLDER = "/images/product-placeholder.svg";

/** WordPress's date format of the snapshot ("2026-11-01T11:23:57", site time = UTC). */
const siteDate = (date: Date | null) => (date ?? new Date(0)).toISOString().slice(0, 19);

function quickShopOf(attributes: ProductAttribute[]): QuickShopAttribute[] {
  return attributes.map(({ name, label, swatches, options }) => ({ name, label, swatches, options }));
}

function catalogImage(picture: { url: string; alt?: string; width?: number; height?: number }): CatalogImage {
  return { src: picture.url, width: picture.width ?? 600, height: picture.height ?? 600, alt: picture.alt ?? "" };
}

function variationImage(image: VariantImage | null): Variation["image"] {
  return image ? { src: image.src, srcset: image.srcset ?? null, sizes: image.sizes ?? null, alt: image.alt ?? "" } : null;
}

export function buildCatalog(base: CatalogBase, rows: DbProductRow[], media: ProductMedia, now: Date, taxonomy: Taxonomy = { categories: [], attributes: [] }): BuiltCatalog {
  const baseProducts = new Map(base.products.map((p) => [p.id, p]));
  const basePages = new Map(base.pages.map((p) => [p.id, p]));
  const fromDb = taxonomy.categories.length ? categoriesFrom(taxonomy.categories) : { categories: base.categories, shopCarousel: base.shopCarousel };
  const allCategories = fromDb.categories;
  const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c]));
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));
  const shopAttributes = new Map(taxonomy.attributes.map((a) => [`attribute_pa_${a.slug}`, a]));
  const backorder: BuiltCatalog["backorder"] = {};
  const visible = rows.filter((row) => row.status === "publish");
  const defaultStyles = DEFAULT_PAGE_STYLES(base.pages);
  const cardCategories = (slugs: string[]) =>
    allCategories.filter((c) => slugs.includes(c.slug)).map((c) => ({ name: c.name, path: c.path }));

  // Categories renamed, moved or removed since the snapshot: the snapshot's cards, breadcrumbs and
  // page details that name them are written again (nothing to do while none changed).
  const baseByPath = new Map(base.categories.map((c) => [c.path, c]));
  const changedSlugs = new Set(
    base.categories
      .filter((c) => {
        const current = categoryBySlug.get(c.slug);
        return !current || current.name !== c.name || current.path !== c.path || current.parent !== c.parent;
      })
      .map((c) => c.slug),
  );
  const renamed = <T extends { path: string | null }>(list: T[], label: "name" | "label"): T[] =>
    changedSlugs.size === 0
      ? list
      : list.flatMap((item) => {
          const was = item.path === null ? undefined : baseByPath.get(item.path);
          if (!was || !changedSlugs.has(was.slug)) return [item];
          const current = categoryBySlug.get(was.slug);
          return current ? [{ ...item, [label]: current.name, path: current.path }] : [];
        });
  /** The category trail of a breadcrumb (Home › parents › category › product), from the current tree. */
  const trailOf = (first: Category | undefined) => {
    const chain: Category[] = [];
    const seen = new Set<number>();
    for (let c = first; c && !seen.has(c.id); c = categoryById.get(c.parent)) {
      seen.add(c.id);
      chain.unshift(c);
    }
    return chain;
  };

  const products: Product[] = visible.map((row) => {
    const original = baseProducts.get(row.shopId);
    const published = row.variants.filter((v) => v.status === "publish").sort((a, b) => a.sortOrder - b.sortOrder);
    const path = `/product/${row.slug}/`;
    const pictures = media[row.sanityId] ?? [];

    let variations: Variation[] = [];
    let priceMin: bigint;
    let priceMax: bigint;
    let inStock: boolean;
    let sale: { onSale: true; regularPrice: bigint } | null = null;
    if (row.type === "variable") {
      const originalVariations = new Map((original?.variations ?? []).map((v) => [v.id, v]));
      variations = published
        .filter((v) => v.shopId !== null)
        .map((v) => {
          const hold = backorderOf(v);
          if (hold) backorder[String(v.shopId)] = hold;
          const price = currentPrice(v, now);
          return {
            id: v.shopId!,
            attributes: v.attributes,
            price,
            inStock: isAvailable(v),
            image: variationImage(v.image) ?? originalVariations.get(v.shopId!)?.image ?? null,
            ...(price !== v.regularPriceMinor ? { onSale: true, regularPrice: v.regularPriceMinor } : {}),
          };
        });
      // A variation without a price (0) can't be bought: WooCommerce leaves it out of the price range.
      const prices = variations.map((v) => v.price).filter((price) => price > 0n);
      priceMin = prices.length ? prices.reduce((a, b) => (b < a ? b : a)) : 0n;
      priceMax = prices.length ? prices.reduce((a, b) => (b > a ? b : a)) : 0n;
      inStock = variations.some((v) => v.inStock);
      // WooCommerce strikes the regular price through only when the range collapses to one price and
      // the regular prices agree too (WC_Product_Variable::get_price_html); else it shows the range.
      if (variations.some((v) => v.onSale) && priceMin === priceMax) {
        const regulars = variations.filter((v) => v.price > 0n).map((v) => v.regularPrice ?? v.price);
        if (regulars.length && regulars.every((r) => r === regulars[0]) && regulars[0] > priceMin) sale = { onSale: true, regularPrice: regulars[0] };
      }
      // WooCommerce marks the parent "on backorder" when none of its variations is simply in stock.
      const holds = published.filter((v) => v.shopId !== null).map((v) => backorderOf(v));
      if (holds.some(Boolean) && published.every((v, i) => v.shopId === null || holds[i] || !isAvailable(v))) {
        backorder[String(row.shopId)] = { notify: holds.some((h) => h?.notify) };
      }
    } else {
      const only = published[0];
      priceMin = priceMax = only ? currentPrice(only, now) : 0n;
      if (only && priceMin !== only.regularPriceMinor) sale = { onSale: true, regularPrice: only.regularPriceMinor };
      inStock = only ? isAvailable(only) : false;
      const hold = only ? backorderOf(only) : null;
      if (hold) backorder[String(row.shopId)] = hold;
    }

    const quickShop = quickShopOf(withShopAttributes(row.attributes, shopAttributes));
    const sameAttributes = original ? sameJson(original.quickShop, quickShop) : false;
    const sameCategories = original ? sameJson(original.categories, row.categorySlugs) : false;
    return {
      ...(original ?? {
        hoverImage: null,
        searchImage: null,
        image: { src: PLACEHOLDER, width: 600, height: 600, alt: row.name },
        ranks: { menu_order: Infinity, date: Infinity, price: Infinity, "price-desc": Infinity, title: Infinity },
      }),
      id: row.shopId,
      slug: row.slug,
      path,
      name: row.name,
      type: row.type,
      date: original && sameJson(original.date, siteDate(row.publishedAt)) ? original.date : siteDate(row.publishedAt),
      categories: row.categorySlugs,
      cardCategories: sameCategories ? renamed(original!.cardCategories, "name") : cardCategories(row.categorySlugs),
      ...(pictures.length
        ? { image: catalogImage(pictures[0]), hoverImage: pictures[1] ? catalogImage(pictures[1]) : null, searchImage: catalogImage(pictures[0]) }
        : {}),
      priceMin,
      priceMax,
      inStock,
      ...(sale ?? {}),
      quickShop: sameAttributes ? original!.quickShop : quickShop,
      searchOptions: sameAttributes ? original!.searchOptions : quickShop.map(({ name, label, options }) => ({ name, label, options })),
      variations,
    } as Product;
  });

  // Sort positions. Products whose sort value hasn't changed keep the live shop's order among
  // themselves (its ties and quirks included); new products and changed values are slotted in by value.
  const rowById = new Map(visible.map((r) => [r.shopId, r]));
  const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
  const sorts: { key: SortKey; compare: (a: Product, b: Product) => number; same: (p: Product, o: Product) => boolean }[] = [
    { key: "menu_order", compare: (a, b) => rowById.get(a.id)!.menuOrder - rowById.get(b.id)!.menuOrder, same: (p, o) => rowById.get(p.id)!.menuOrder === o.ranks.menu_order },
    { key: "date", compare: (a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1), same: (p, o) => p.date === o.date },
    { key: "price", compare: (a, b) => cmp(a.priceMin, b.priceMin), same: (p, o) => p.priceMin === o.priceMin },
    { key: "price-desc", compare: (a, b) => cmp(b.priceMax, a.priceMax), same: (p, o) => p.priceMax === o.priceMax },
    { key: "title", compare: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }), same: (p, o) => p.name === o.name },
  ];
  for (const { key, compare, same } of sorts) {
    const kept = products.filter((p) => baseProducts.has(p.id) && same(p, baseProducts.get(p.id)!)).sort((a, b) => baseProducts.get(a.id)!.ranks[key] - baseProducts.get(b.id)!.ranks[key]);
    const moved = products.filter((p) => !kept.includes(p)).sort((a, b) => compare(a, b) || b.id - a.id);
    const order = [...kept];
    for (const product of moved) {
      const at = order.findIndex((other) => compare(product, other) < 0);
      order.splice(at < 0 ? order.length : at, 0, product);
    }
    order.forEach((p, i) => {
      p.ranks = { ...p.ranks, [key]: i };
    });
  }

  const visibleIds = new Set(products.map((p) => p.id));
  const pages: ProductPageData[] = products.map((product) => {
    const row = rowById.get(product.id)!;
    const original = basePages.get(product.id);
    const pictures = media[row.sanityId] ?? [];
    const crumbsFor = (first: Category | undefined) => [{ label: "Home", path: "" }, ...trailOf(first).map((c) => ({ label: c.name, path: c.path })), { label: row.name, path: null }];
    const breadcrumbs = crumbsFor(row.categorySlugs.map((s) => categoryBySlug.get(s)).find(Boolean));
    const metaCategories = cardCategories(row.categorySlugs);
    const attributes = withShopAttributes(row.attributes, shopAttributes);

    let form: ProductForm;
    if (row.type === "variable") {
      const originalImages = original?.form.type === "variable" ? original.form.images : {};
      const images: Record<string, NonNullable<Extract<ProductForm, { type: "variable" }>["images"]>[string]> = {};
      const originalIds = new Set((baseProducts.get(product.id)?.variations ?? []).map((v) => v.id));
      for (const v of row.variants) {
        // Only variations that can be bought (published, with a price) have a picture in the form.
        if (v.shopId === null || v.status !== "publish" || currentPrice(v, now) <= 0n) continue;
        const picture = originalImages[String(v.shopId)];
        if (picture) images[String(v.shopId)] = picture;
        else if (v.image && !originalIds.has(v.shopId)) images[String(v.shopId)] = { src: v.image.src, srcset: v.image.srcset, sizes: v.image.sizes, width: v.image.width ?? 600, height: v.image.height ?? 600, alt: v.image.alt, title: null, full: { src: v.image.src, width: v.image.width ?? 600, height: v.image.height ?? 600 } };
      }
      form = { type: "variable", attributes: attributes.map((a) => ({ name: a.name, label: a.label, swatches: a.swatches, options: a.options, default: a.default })), images };
      if (original?.form.type === "variable" && sameJson({ ...original.form, images: {} }, { ...form, images: {} }) && sameJson(Object.keys(original.form.images).sort(), Object.keys(images).sort())) form = original.form;
    } else {
      form = !product.inStock ? { type: "none" } : original && original.form.type !== "none" ? original.form : { type: "simple", min: 1, max: null };
    }

    const gallery: GalleryImage[] = pictures.map((p) => ({ ...catalogImage(p), title: null, full: { src: p.url, width: p.width ?? 600, height: p.height ?? 600 } }));
    if (original) {
      const retitled = original.title !== row.name;
      const recategorised = !sameJson(baseProducts.get(product.id)?.categories, row.categorySlugs);
      // The snapshot's breadcrumb follows the product's main category (Yoast's primary one): when a
      // category in it was renamed or moved, the same category's current trail.
      const crumbCategory = [...original.breadcrumbs].reverse().map((c) => (c.path ? baseByPath.get(c.path) : undefined)).find(Boolean);
      let crumbs = recategorised
        ? breadcrumbs
        : crumbCategory && original.breadcrumbs.some((c) => c.path && changedSlugs.has(baseByPath.get(c.path)?.slug ?? ""))
          ? crumbsFor(categoryBySlug.get(crumbCategory.slug))
          : original.breadcrumbs;
      if (retitled && !recategorised) crumbs = crumbs.map((c, i, all) => (i === all.length - 1 ? { ...c, label: row.name } : c));
      return {
        ...original,
        title: row.name,
        breadcrumbs: crumbs,
        ...(gallery.length ? { gallery, thumbnails: gallery.map(thumbnail) } : {}),
        form,
        related: original.related.filter((id) => visibleIds.has(id)),
        meta: recategorised ? { ...original.meta, categories: metaCategories } : { ...original.meta, categories: renamed(original.meta.categories, "name") },
      };
    }
    // Related: products of the same categories (sub-categories included), in the shop's order.
    const family = new Set<string>();
    for (const slug of row.categorySlugs) {
      const category = categoryBySlug.get(slug);
      if (category) familySlugs(category, allCategories).forEach((s) => family.add(s));
      else family.add(slug);
    }
    const related = products
      .filter((p) => p.id !== product.id && p.categories.some((c) => family.has(c)))
      .sort((a, b) => a.ranks.menu_order - b.ranks.menu_order)
      .slice(0, 4)
      .map((p) => p.id);
    return {
      id: product.id,
      title: row.name,
      breadcrumbs,
      gallery: gallery.length ? gallery : [{ ...product.image, title: null, full: { src: product.image.src, width: product.image.width, height: product.image.height } }],
      thumbnails: gallery.length ? gallery.map(thumbnail) : [product.image],
      shortDescription: null,
      includedSupplies: null,
      form,
      afterAddToCart: [701],
      connectedFormats: null,
      tabs: [],
      related,
      elementorStyles: defaultStyles,
      seo: { title: `${row.name} | Atlas Longevity`, description: null, robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1", ogType: "product", ogTitle: `${row.name} | Atlas Longevity`, ogDescription: null },
      meta: { sku: null, categories: metaCategories },
    };
  });

  return { products, pages, backorder, categories: withProductCounts(allCategories, products), shopCarousel: fromDb.shopCarousel };
}
