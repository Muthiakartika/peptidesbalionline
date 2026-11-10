"""
Snapshot of every single-product page (/product/<slug>/) of the live site, for the rebuilt product
pages until the catalogue moves to Sanity + PostgreSQL (Phase 4). It only READS public pages.

For each product it keeps what the page shows that catalog.json does not have:
  * the gallery (every image with its srcset and the full-size file used by the zoom),
  * the breadcrumb trail, the short description and the cream "included supplies" note,
  * the variation form as the product page shows it (labels, pills or dropdown, default choice)
    and the picture each variation shows in the gallery,
  * the "Also available as" box (owner's connected-formats snippet),
  * every tab (title + content HTML, exactly as rendered),
  * the related products (ids, in order) and the Yoast tags,
  * for the quick-view popup: the SKU and the categories (Store API), as its "SKU: … Categories: …".

Shared pieces are stored once: the Elementor blocks inside the pages (e.g. #701, the green buttons
under "Add to cart") and the list of Elementor stylesheets each page needs.

Output (generated, do not edit by hand): src/content/product-pages.json

Usage (from the project root, after export_shop_snapshot.py):
    python scripts/audit/export_product_pages.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_shop_snapshot import fetch, get_json_all, image, local_path, seo  # noqa: E402  (same helpers, same rules)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content" / "product-pages.json"


def inner_html(element) -> str | None:
    if element is None:
        return None
    return "".join(str(child) for child in element.contents).strip()


def gallery(soup: BeautifulSoup) -> list[dict]:
    images = []
    for slide in soup.select(".woocommerce-product-gallery__image"):
        img = slide.find("img")
        if not img:
            continue
        data = image(img)
        # Here data-src is the full-size file (for the zoom); the picture shown is src (600 px),
        # unless src is only the lazy-loader's placeholder.
        if img.get("src") and not img["src"].startswith("data:"):
            data["src"] = img["src"]
        data["title"] = img.get("title")  # the browser's tooltip on hover
        link = slide.find("a")
        data["full"] = {
            "src": img.get("data-large_image") or (link.get("href") if link else None),
            "width": int(img.get("data-large_image_width") or 0),
            "height": int(img.get("data-large_image_height") or 0),
        }
        images.append(data)
    return images


def thumbnails(soup: BeautifulSoup) -> list[dict]:
    # Skip the <noscript> copy that the lazy-loader puts next to every image.
    return [image(img) for img in soup.select(".wd-gallery-thumb img") if not img.find_parent("noscript")]


def variation_form(summary) -> dict:
    form = summary.select_one("form.cart")
    if form is None:
        return {"type": "none"}
    if "variations_form" not in form.get("class", []):
        quantity = form.select_one("input.qty")
        return {
            "type": "simple",
            "min": int(quantity.get("min") or 1) if quantity else 1,
            "max": int(quantity.get("max")) if quantity and quantity.get("max") else None,
        }
    rows = []
    for row in form.select("table.variations tr"):
        select = row.select_one("select")
        selected = select.select_one("option[selected]")
        rows.append(
            {
                "name": select["name"],
                "label": row.select_one("th label").get_text(strip=True),
                "swatches": row.select_one(".wd-swatches-product") is not None,
                "options": [{"value": o["value"], "label": o.get_text(strip=True)} for o in select.select("option") if o.get("value")],
                "default": selected.get("value") if selected and selected.get("value") else None,
            }
        )
    return {"type": "variable", "attributes": rows, "images": variation_images(form)}


def variation_images(form) -> dict:
    """The picture each variation puts in the gallery, from the form's data-product_variations JSON
    (the 600x600 "single" size, its srcset, the tooltip title and the full-size file for the zoom).
    WooCommerce leaves the JSON out ("false") on products with very many variations."""
    try:
        variations = json.loads(form.get("data-product_variations") or "false") or []
    except json.JSONDecodeError:
        return {}
    images = {}
    for variation in variations:
        data = variation.get("image") or {}
        if not data.get("src"):
            continue
        images[str(variation["variation_id"])] = {
            "src": data["src"],
            "srcset": data.get("srcset") or None,
            "sizes": data.get("sizes") or None,
            "width": int(data.get("src_w") or 0),
            "height": int(data.get("src_h") or 0),
            "alt": data.get("alt") or "",
            "title": data.get("title") or None,
            "full": {"src": data.get("full_src") or data["src"], "width": int(data.get("full_src_w") or 0), "height": int(data.get("full_src_h") or 0)},
        }
    return images


def tabs(soup: BeautifulSoup) -> list[dict]:
    result = []
    for title in soup.select(".wd-nav-tabs li"):
        key = title.find("a")["href"].removeprefix("#tab-")  # "description", "wd_custom_tab", "wd_custom_tab_2"…
        panel = soup.find(id=f"tab-{key}")
        inner = panel.select_one(".wc-tab-inner") if panel else None
        result.append({"key": key, "title": title.get_text(strip=True), "html": inner_html(inner if inner else panel)})
    return result


def elementor_ids(element) -> list[int]:
    return [int(e["data-elementor-id"]) for e in element.select("[data-elementor-id]")] if element else []


def product_meta() -> dict:
    """SKU and categories per product id, from the public Store API (what the quick-view popup lists
    under the form). WordPress lists the categories by name, A–Z."""
    meta = {}
    for product in get_json_all("/wp-json/wc/store/v1/products"):
        categories = sorted(product.get("categories") or [], key=lambda c: c["name"].lower())
        meta[str(product["id"])] = {
            "sku": product.get("sku") or None,
            "categories": [{"name": html.unescape(c["name"]), "path": local_path(c["link"])} for c in categories],
        }
    return meta


def main() -> int:
    catalog = json.loads((ROOT / "src" / "content" / "catalog.json").read_text(encoding="utf-8"))
    meta = product_meta()
    pages = {}
    blocks = {}
    stylesheets = set()
    for index, product in enumerate(catalog["products"], start=1):
        html = fetch(product["path"])
        soup = BeautifulSoup(html, "lxml")
        summary = soup.select_one(".summary.entry-summary")
        after = summary.select_one(".wd-after-add-to-cart")
        after_ids = elementor_ids(after)
        for block in after.select("[data-elementor-id]") if after else []:
            blocks.setdefault(int(block["data-elementor-id"]), str(block))
        breadcrumbs = [
            {"label": a.get_text(strip=True), "path": local_path(a["href"])} for a in summary.select(".wd-breadcrumbs a")
        ] + [{"label": s.get_text(strip=True), "path": None} for s in summary.select(".wd-breadcrumbs .wd-last")]
        css = sorted({int(n) for n in re.findall(r"uploads/elementor/css/post-(\d+)\.css", html)})
        stylesheets.update(css)
        pages[product["path"]] = {
            "id": product["id"],
            "title": summary.select_one("h1.product_title").get_text(strip=True),
            "breadcrumbs": breadcrumbs,
            "gallery": gallery(soup),
            "thumbnails": thumbnails(soup),
            "shortDescription": inner_html(summary.select_one(".woocommerce-product-details__short-description")),
            "includedSupplies": inner_html(summary.select_one(".sleeks-included-supplies")),
            "form": variation_form(summary),
            "afterAddToCart": after_ids,
            "connectedFormats": inner_html(summary.select_one(".atlas-connected-formats")),
            "tabs": tabs(soup),
            "related": [int(card["data-id"]) for card in soup.select(".related-products .wd-product")],
            "elementorStyles": css,
            "seo": seo(soup),
            "meta": meta.get(str(product["id"]), {"sku": None, "categories": []}),
        }
        print(f"{index:3}/{len(catalog['products'])} {product['path']}  tabs={len(pages[product['path']]['tabs'])} images={len(pages[product['path']]['gallery'])}", flush=True)
        time.sleep(0.6)

    # WooCommerce shuffles the related products on every page load, so each export draws a different set.
    # Keep the previous draw while all of its products still exist: a new export then only shows real edits.
    try:
        previous = json.loads(OUT.read_text(encoding="utf-8")).get("pages", {})
    except (OSError, ValueError):
        previous = {}
    existing = {int(p["id"]) for p in catalog["products"]}
    for path, page in pages.items():
        earlier = previous.get(path, {}).get("related")
        if earlier and len(earlier) == len(page["related"]) and all(int(i) in existing for i in earlier):
            page["related"] = earlier

    OUT.write_text(
        json.dumps({"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "blocks": blocks, "stylesheets": sorted(stylesheets), "pages": pages}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"product-pages.json: {len(pages)} pages, {len(blocks)} shared blocks, {len(stylesheets)} Elementor stylesheets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
