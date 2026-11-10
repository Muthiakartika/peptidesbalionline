// The live shop's catalogue (src/content/catalog.json, product-pages.json, stock-status.json) → rows of
// the store database (product_records, product_variants, inventory, product_categories,
// product_attributes). Pure functions, used by import-catalog.mjs and by the tests that check the shop
// built from these rows equals the snapshot.

/** A variation's stable key from its attributes, e.g. "mg=10;pen-type=disposable-pen" ("*" = any). */
export function variantKeyOf(attributes) {
  const entries = Object.entries(attributes ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return "default";
  return entries.map(([name, value]) => `${name.replace(/^attribute_(pa_)?/, "")}=${value || "*"}`).join(";");
}

/** WooCommerce's stock status for a product or variation: on backorder (orderable), in stock or out. */
function stockOf(inStock, backorder) {
  if (backorder) return { stockStatus: "onbackorder", backorders: backorder.notify ? "notify" : "yes" };
  return { stockStatus: inStock ? "instock" : "outofstock", backorders: "no" };
}

/**
 * One entry per product: { record, variants: [{ ...variant, inventory }] }. Prices are minor units
 * (IDR × 100) as numbers; the importer sends them as bigint. The snapshot only knows the price a
 * product sells for, so the regular price is that price and there is no sale price.
 */
export function catalogRows(catalog, productPages, stockStatus) {
  const backorder = stockStatus?.backorder ?? {};
  return catalog.products.map((product) => {
    const page = productPages.pages[product.path];
    const form = page?.form;
    const attributes =
      form?.type === "variable"
        ? form.attributes.map((a) => ({ name: a.name, label: a.label, swatches: a.swatches, options: a.options, default: a.default ?? null }))
        : product.quickShop.map((a) => ({ name: a.name, label: a.label, swatches: a.swatches, options: a.options, default: null }));
    const record = {
      shopId: product.id,
      legacyWcProductId: product.id,
      sanityId: `product-${product.slug}`,
      slug: product.slug,
      name: product.name,
      type: product.type,
      status: "publish",
      categorySlugs: product.categories,
      menuOrder: product.ranks.menu_order,
      publishedAt: `${product.date}Z`,
      attributes,
    };
    const variants =
      product.type === "variable"
        ? product.variations.map((variation, index) => ({
            variantKey: variantKeyOf(variation.attributes),
            shopId: variation.id,
            legacyWcVariationId: variation.id,
            attributes: variation.attributes,
            priceMinor: variation.price,
            regularPriceMinor: variation.price,
            image: variation.image,
            sortOrder: index,
            inventory: stockOf(variation.inStock, backorder[variation.id]),
          }))
        : [
            {
              variantKey: "default",
              shopId: null,
              legacyWcVariationId: null,
              attributes: {},
              priceMinor: product.priceMin,
              regularPriceMinor: product.priceMin,
              image: null,
              sortOrder: 0,
              inventory: stockOf(product.inStock, backorder[product.id]),
            },
          ];
    // Two variations with the same options would clash on (product, key): keep both apart.
    const seen = new Set();
    for (const variant of variants) {
      if (seen.has(variant.variantKey)) variant.variantKey = `${variant.variantKey}#${variant.shopId}`;
      seen.add(variant.variantKey);
    }
    return { record, variants };
  });
}

/**
 * The 25 product categories. A category's place in the round-picture carousel (its parent's, or the
 * shop's for a top-level one) is its sort order, and the carousel's picture its tile picture; every
 * category is in exactly one carousel on live.
 */
export function categoryRows(catalog) {
  const tiles = new Map();
  catalog.shopCarousel.forEach((tile, i) => tiles.set(tile.path, { image: tile.image, order: i }));
  for (const category of catalog.categories) (category.carousel ?? []).forEach((tile, i) => tiles.set(tile.path, { image: tile.image, order: i }));
  return catalog.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent,
    title: c.title,
    sortOrder: tiles.get(c.path)?.order ?? 0,
    tileImage: tiles.get(c.path)?.image ?? null,
    searchImage: c.searchImage ?? null,
    seo: c.seo,
  }));
}

/** The number in a value's name, for putting values nobody orders against each other in a sensible order. */
const amountOf = (label) => {
  const match = /\d[\d,.]*/.exec(label);
  return match ? Number(match[0].replace(/,/g, "")) : Infinity;
};

/**
 * The shop-wide attributes (attribute_pa_*: MG, Pen Type, IU, Storage) with every value the products
 * use. Their order is the products' own (WooCommerce lists a product's values in the attribute's custom
 * order; no two products disagree): values that never appear together are put by their number.
 * Product-only attributes (Vial Size, Variation) stay on their product.
 */
export function attributeRows(catalog, productPages) {
  const lists = new Map();
  for (const { record } of catalogRows(catalog, productPages, {})) {
    for (const attribute of record.attributes) {
      if (!attribute.name.startsWith("attribute_pa_")) continue;
      const entry = lists.get(attribute.name) ?? { label: attribute.label, swatches: attribute.swatches, labels: new Map(), orders: [] };
      for (const option of attribute.options) if (!entry.labels.has(option.value)) entry.labels.set(option.value, option.label);
      entry.orders.push(attribute.options.map((o) => o.value));
      lists.set(attribute.name, entry);
    }
  }
  return [...lists].map(([name, entry]) => {
    // A topological order of "a comes before b" from every product's list.
    const after = new Map([...entry.labels.keys()].map((v) => [v, new Set()]));
    const before = new Map([...entry.labels.keys()].map((v) => [v, 0]));
    for (const order of entry.orders) {
      for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length; j++) {
          if (!after.get(order[i]).has(order[j])) {
            after.get(order[i]).add(order[j]);
            before.set(order[j], before.get(order[j]) + 1);
          }
        }
      }
    }
    const terms = [];
    const ready = [...before].filter(([, n]) => n === 0).map(([v]) => v);
    const byAmount = (a, b) => amountOf(entry.labels.get(a)) - amountOf(entry.labels.get(b)) || entry.labels.get(a).localeCompare(entry.labels.get(b));
    while (ready.length) {
      ready.sort(byAmount);
      const value = ready.shift();
      terms.push({ value, label: entry.labels.get(value) });
      for (const next of after.get(value)) {
        before.set(next, before.get(next) - 1);
        if (before.get(next) === 0) ready.push(next);
      }
    }
    if (terms.length !== entry.labels.size) throw new Error(`${name}: the products list its values in conflicting orders.`);
    return { slug: name.replace(/^attribute_pa_/, ""), label: entry.label, swatches: entry.swatches, terms };
  });
}
