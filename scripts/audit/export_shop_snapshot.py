"""
Builds the catalogue snapshot that the rebuilt shop pages read until the catalogue moves to
Sanity + PostgreSQL (Phase 4). It only READS public pages and the public Store API.

What it collects, and where each piece comes from:

  * The shop pages (/shop/page/N/) give the default product order and everything a product card
    shows: image, second "hover" image, category labels, quick-shop options (which attribute is a
    pill "swatch" and which is a dropdown).
  * The shop pages sorted by date / price / title give the order for the other sort options.
  * Each category page gives its title, breadcrumbs and the round sub-category images.
  * The live header search (read-only AJAX) gives the suggestion thumbnails, and the owner's
    "search buy" lookup the option order shown under each suggestion.
  * The Store API (/wp-json/wc/store/v1/) gives prices, every variation and variation images; the
    WP REST API gives each product's publish date.

Output (generated, do not edit by hand):
  src/content/catalog.json          products, categories, sort ranks, SEO tags, search thumbnails

Usage (from the project root):
    python scripts/audit/export_shop_snapshot.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
import urllib.parse
from urllib.parse import urlparse

from bs4 import BeautifulSoup

SITE = "https://peptidesbali.online"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content"

import urllib.error


def _previous_search_images() -> dict:
    """The search thumbnails of the snapshot being replaced (a fallback when one live search fails)."""
    try:
        previous = json.loads((OUT / "catalog.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    items = previous.get("products", []) + previous.get("categories", [])
    return {item["path"]: item.get("searchImage") for item in items if item.get("path") and item.get("searchImage")}


PREVIOUS_SEARCH_IMAGES = _previous_search_images()
GRID = ".elementor-widget-wd_archive_products .products > .wd-product"


def fetch(path: str) -> str:
    # Cloudflare serves cached copies of shop pages that can be a day old. An extra, unused query
    # argument skips that cache, so the snapshot shows the site as it is right now.
    path += ("&" if "?" in path else "?") + f"_fresh={int(time.time())}"
    request = urllib.request.Request(SITE + path, headers={"User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read().decode("utf-8")
        except Exception:  # network hiccup: wait and retry
            if attempt == 2:
                raise
            time.sleep(3)
    raise RuntimeError("unreachable")


def search_buy_data(paths: list[str]) -> dict:
    """
    The owner's custom "Atlas search buy" snippet adds option pills and an Add to cart button to each
    search suggestion. It loads them from admin-ajax (action=atlas_search_quick_data), a read-only
    lookup that every visitor's browser calls while searching. We read the same data so the rebuild
    shows the options in the same order (it differs from the product card's order).
    """
    result = {}
    for start in range(0, len(paths), 5):  # the live script asks for 5 URLs at a time
        batch = paths[start : start + 5]
        body = urllib.parse.urlencode([("action", "atlas_search_quick_data")] + [("urls[]", SITE + p) for p in batch]).encode()
        request = urllib.request.Request(f"{SITE}/wp-admin/admin-ajax.php", data=body, headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))["data"]
        for p in batch:
            result[p] = data.get(SITE + p)
        time.sleep(0.5)
    return result


def suggestion_images(queries: dict[str, str], retry: bool = False) -> dict:
    """
    The header search shows a square thumbnail (300/150/80px crops) per suggestion. Those crops are
    not in the Store API, so we ask the live search itself (read-only), once per product or category
    title, and keep the <img> of the suggestion whose link is that item. queries: {path: title}.
    """
    found = {}
    for path, title in queries.items():
        # The live search compares with the stored title (" - " and "'" where the page shows " – "
        # and "’"), so search with that form.
        title = title.replace(" – ", " - ").replace("’", "'").replace("‘", "'")
        url = f"{SITE}/wp-admin/admin-ajax.php?" + urllib.parse.urlencode(
            # number=200: the item must be in the answer even when its title matches many products.
            {"action": "woodmart_ajax_search", "number": 200, "post_type": "product", "query": title, "include_cat_search": "yes"}
        )
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        suggestions = None
        for attempt in range(2):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    suggestions = json.loads(response.read().decode("utf-8")).get("suggestions", [])
                break
            except urllib.error.HTTPError as error:
                # The live site's firewall sometimes answers 404 to one query (7 Nov 2026): wait, try once more.
                print(f"  search for {path} answered {error.code}{', retrying' if attempt == 0 else ''}")
                time.sleep(3)
        if suggestions is None:
            # Keep the thumbnail of the previous snapshot rather than stopping the whole export.
            if path in PREVIOUS_SEARCH_IMAGES:
                found[path] = PREVIOUS_SEARCH_IMAGES[path]
                print(f"  kept the previous search thumbnail of {path}")
            continue
        for suggestion in suggestions:
            if local_path(suggestion.get("permalink", "")) == path:
                img = BeautifulSoup(suggestion.get("thumbnail") or "", "lxml").find("img")
                found[path] = image(img) if img else None
                break
        time.sleep(0.4)
        if path not in found and " " in title and not retry:
            # A few titles are stored differently again ("&amp;"); the first words always match.
            found.update(suggestion_images({path: " ".join(title.split()[:3])}, retry=True))
    return found


def get_json_all(path: str) -> list:
    items: list = []
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        request = urllib.request.Request(f"{SITE}{path}{separator}per_page=100&page={page}", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response:
            total = int(response.headers.get("X-WP-TotalPages", "1"))
            items.extend(json.loads(response.read().decode("utf-8")))
        if page >= total:
            return items
        page += 1
        time.sleep(0.5)


def single_image_sizes(api_sizes: str | None) -> str | None:
    """
    The Store API gives the full-size "sizes" ("(max-width: 1254px) 100vw, 1254px"). The page uses
    WooCommerce's "single" size instead, 600px wide (or the full width when the file is smaller).
    """
    match = re.search(r"(\d+)px\)", api_sizes or "")
    if not match:
        return None
    width = min(600, int(match.group(1)))
    return f"(max-width: {width}px) 100vw, {width}px"


def local_path(url: str) -> str:
    """https://peptidesbali.online/product/x/ -> /product/x/"""
    return urlparse(url).path


def image(img) -> dict | None:
    if img is None:
        return None
    data = {
        "src": img.get("data-src") or img.get("src"),
        "width": int(img.get("width") or 0),
        "height": int(img.get("height") or 0),
        "alt": img.get("alt", ""),
    }
    # The live page lazy-loads with data-srcset; phones pick a smaller file from it (600w at 390px).
    srcset = img.get("data-srcset") or img.get("srcset")
    if srcset:
        data["srcset"] = srcset
        data["sizes"] = img.get("data-sizes") or img.get("sizes")
    return data


def seo(soup: BeautifulSoup) -> dict:
    """The Yoast tags we reproduce: <title>, meta description and robots, Open Graph title/description."""
    def meta(**attrs):
        tag = soup.find("meta", attrs=attrs)
        return tag.get("content") if tag else None
    return {
        "title": soup.title.get_text(strip=True),
        "description": meta(name="description"),
        "robots": meta(name="robots"),
        "ogType": meta(property="og:type"),
        "ogTitle": meta(property="og:title"),
        "ogDescription": meta(property="og:description"),
    }


def listing_pages(query: str = "") -> list[BeautifulSoup]:
    """Every page of /shop/ for one sort order."""
    pages = []
    number = 1
    while True:
        path = "/shop/" if number == 1 else f"/shop/page/{number}/"
        soup = BeautifulSoup(fetch(path + query), "lxml")
        pages.append(soup)
        if not soup.select_one(".woocommerce-pagination a.next"):
            return pages
        number += 1
        time.sleep(0.6)


def parse_card(card) -> dict:
    form = card.select_one("form.variations_form")
    attributes = []
    if form:
        for row in form.select("table.variations tr"):
            select = row.select_one("select")
            attributes.append(
                {
                    "name": select["name"],
                    "label": row.select_one("th label").get_text(strip=True),
                    "swatches": row.select_one(".wd-swatches-product") is not None,
                    "options": [
                        {"value": o["value"], "label": o.get_text(strip=True)}
                        for o in select.select("option")
                        if o.get("value")
                    ],
                }
            )
    return {
        "id": int(card["data-id"]),
        "path": local_path(card.select_one(".wd-entities-title a")["href"]),
        "image": image(card.select_one(".product-image-link img")),
        "hoverImage": image(card.select_one(".hover-img img")),
        "cardCategories": [local_path(a["href"]) for a in card.select(".wd-product-cats a")],
        "usdText": card.select_one(".atlas-usd-price").get_text(strip=True) if card.select_one(".atlas-usd-price") else None,
        "quickShop": attributes,
    }


def ids_in(pages: list[BeautifulSoup]) -> list[int]:
    return [int(card["data-id"]) for soup in pages for card in soup.select(GRID)]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    # 1. Default order (the "Sort by popularity" option is really the custom menu order) + card data.
    default_pages = listing_pages()
    cards = {}
    for soup in default_pages:
        for card in soup.select(GRID):
            data = parse_card(card)
            cards[data["id"]] = data
    default_order = ids_in(default_pages)
    print(f"default order: {len(default_order)} products on {len(default_pages)} pages")

    # 2. The other sort orders, read from the live shop (24 per page = fewer requests).
    ranks = {"menu_order": default_order}
    for orderby in ("date", "price", "price-desc", "title"):
        ranks[orderby] = ids_in(listing_pages(f"?orderby={orderby}&per_page=24"))
        print(f"order {orderby}: {len(ranks[orderby])}")

    # 3. Store API: prices, variations, search text.
    api_products = {p["id"]: p for p in get_json_all("/wp-json/wc/store/v1/products")}
    api_variations = {v["id"]: v for v in get_json_all("/wp-json/wc/store/v1/products?type=variation")}
    api_categories = get_json_all("/wp-json/wc/store/v1/products/categories")
    # Publish dates (the search suggestions are ordered by date). The WP REST API exposes them publicly.
    dates = {p["id"]: p["date"] for p in get_json_all("/wp-json/wp/v2/product?_fields=id,date")}

    search_buy = search_buy_data([cards[pid]["path"] for pid in default_order])
    product_thumbs = suggestion_images({cards[pid]["path"]: html.unescape(api_products[pid]["name"]) for pid in default_order})
    print(f"suggestion thumbnails: {sum(1 for v in product_thumbs.values() if v)} of {len(default_order)} products")

    products = []
    for product_id in default_order:
        api = api_products[product_id]
        card = cards[product_id]
        prices = api["prices"]
        price_range = prices.get("price_range") or {}
        variations = []
        for ref in api["variations"]:
            v = api_variations.get(ref["id"])
            if not v:
                continue
            thumb = (v.get("images") or [{}])[0]
            variations.append(
                {
                    "id": ref["id"],
                    # Store API: [{"name": "Pen Type", "value": "disposable-pen"}]; the form field name is
                    # "attribute_" + taxonomy. An empty value means "any".
                    "attributes": {a["name"]: a["value"] for a in ref["attributes"]},
                    "price": int(v["prices"]["price"]),
                    "inStock": bool(v.get("is_in_stock")),
                    # What the card shows once this variation is chosen (WooCommerce swaps in the
                    # thumbnail as src plus the image's full srcset/sizes).
                    "image": {
                        "src": thumb.get("thumbnail") or thumb.get("src"),
                        "srcset": thumb.get("srcset") or None,
                        "sizes": single_image_sizes(thumb.get("sizes")),
                        "alt": thumb.get("alt", ""),
                    } if thumb.get("src") else None,
                }
            )
        # Map Store API attribute names ("Pen Type") to form field names ("attribute_pa_pen-type").
        # Custom (non-taxonomy) attributes use WordPress's sanitize_title of the name: "Vial Size" -> "vial-size".
        attribute_names = {
            a["name"]: "attribute_" + (a.get("taxonomy") or re.sub(r"[^a-z0-9_-]+", "-", a["name"].lower()).strip("-"))
            for a in api["attributes"]
        }
        for v in variations:
            v["attributes"] = {attribute_names.get(k, k): value for k, value in v["attributes"].items()}
        products.append(
            {
                "id": product_id,
                "slug": api["slug"],
                "path": card["path"],
                "name": html.unescape(api["name"]),
                "type": api["type"],
                "date": dates.get(product_id),
                "categories": [c["slug"] for c in api["categories"]],
                "cardCategories": card["cardCategories"],
                "image": card["image"],
                "hoverImage": card["hoverImage"],
                "searchImage": product_thumbs.get(card["path"]),
                "price": int(prices["price"]),
                "priceMin": int(price_range["min_amount"]) if price_range else int(prices["price"]),
                "priceMax": int(price_range["max_amount"]) if price_range else int(prices["price"]),
                "usdText": card["usdText"],
                "inStock": bool(api["is_in_stock"]),
                "quickShop": card["quickShop"],
                # Attribute + option order used by the search-suggestion buy controls.
                "searchOptions": [
                    {"name": a["key"], "label": a["label"], "options": a["options"]}
                    for a in ((search_buy.get(card["path"]) or {}).get("attributes") or [])
                ],
                "variations": variations,
                "ranks": {key: order.index(product_id) for key, order in ranks.items() if product_id in order},
            }
        )

    # 4. Categories: names/counts from the Store API, title band + carousel from each category page.
    by_id = {c["id"]: c for c in api_categories}
    category_thumbs = suggestion_images({local_path(c["permalink"]): html.unescape(c["name"]) for c in api_categories})
    categories = []
    for c in api_categories:
        path = local_path(c["permalink"])
        soup = BeautifulSoup(fetch(path), "lxml")
        carousel = [
            {"path": local_path(item.select_one("a.category-link")["href"]), "image": image(item.select_one(".wd-cat-image img"))}
            for item in soup.select(".elementor-widget-wd_product_categories .wd-cat")
        ]
        # Check: a category page lists the products of the category and of its sub-categories, in the
        # shop's default order. The rebuild relies on that, so warn if the live site disagrees.
        family = {c["id"]} | {d["id"] for d in api_categories if d["parent"] == c["id"]}
        family |= {d["id"] for d in api_categories if d["parent"] in family}
        expected = [pid for pid in default_order if any(cat["id"] in family for cat in api_products[pid]["categories"])]
        order = ids_in([soup])
        if order != expected[: len(order)]:
            print(f"  WARNING: {path} order differs from the shop order")
        categories.append(
            {
                "id": c["id"],
                "slug": c["slug"],
                "name": html.unescape(c["name"]),
                "parent": c["parent"],
                "count": c["count"],
                "path": path,
                "image": (c.get("image") or {}).get("src"),
                "title": soup.select_one("main h1").get_text(strip=True),
                "seo": seo(soup),
                # Thumbnail in the header search suggestions (some categories have none there).
                "searchImage": category_thumbs.get(path),
                "carousel": carousel,
            }
        )
        time.sleep(0.5)
    print(f"categories: {len(categories)}")

    # The shop page's own carousel (top-level categories in the owner's order).
    shop_carousel = [
        {"path": local_path(item.select_one("a.category-link")["href"]), "image": image(item.select_one(".wd-cat-image img"))}
        for item in default_pages[0].select(".elementor-widget-wd_product_categories .wd-cat")
    ]
    # Every category's parent chain must resolve.
    for c in categories:
        if c["parent"] and c["parent"] not in by_id:
            print(f"  WARNING: {c['slug']} has an unknown parent {c['parent']}")

    snapshot = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": SITE,
        "currency": {"code": "IDR", "minorUnit": 2},
        "shopSeo": seo(default_pages[0]),
        "shopCarousel": shop_carousel,
        "categories": categories,
        "products": products,
    }
    (OUT / "catalog.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"catalog.json: {len(products)} products, {sum(len(p['variations']) for p in products)} variations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
