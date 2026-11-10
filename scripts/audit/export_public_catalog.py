"""
Exports the public catalogue and content metadata of https://peptidesbali.online
using only PUBLIC, read-only endpoints (no login, no API keys):

  * WooCommerce Store API  /wp-json/wc/store/v1/...   (products, variations, categories)
  * WordPress REST API     /wp-json/wp/v2/...         (pages, posts, blog categories)

Output files (docs/audit/data/):
  products.json            every product with its variations, prices and images
  product-categories.json  the WooCommerce category tree
  content.json             pages + blog posts with their Yoast SEO fields
  blog-categories.json     blog categories

Prices from the Store API are integers in "minor units": IDR uses 2 decimals,
so 85000000 means Rp 850,000.00. We keep them as integers on purpose (never
floats) because that is also how the new database will store money.

Usage (from the project root):
    python scripts/audit/export_public_catalog.py
"""

from __future__ import annotations

import html
import json
import sys
import time
import urllib.request
from pathlib import Path

SITE = "https://peptidesbali.online"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
OUT = Path(__file__).resolve().parents[2] / "docs" / "audit" / "data"


def get_json(path: str) -> tuple[object, dict]:
    request = urllib.request.Request(SITE + path, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        headers = {k.lower(): v for k, v in response.headers.items()}
        return json.loads(response.read().decode("utf-8")), headers


def get_all(path: str) -> list:
    """Follows WordPress pagination (X-WP-TotalPages) and returns every item."""
    items: list = []
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        data, headers = get_json(f"{path}{separator}per_page=100&page={page}")
        items.extend(data)
        total_pages = int(headers.get("x-wp-totalpages", "1"))
        if page >= total_pages:
            return items
        page += 1
        time.sleep(0.5)


def text(value: str) -> str:
    return html.unescape(value or "").strip()


def export_products() -> None:
    products = get_all("/wp-json/wc/store/v1/products")
    variations = {v["id"]: v for v in get_all("/wp-json/wc/store/v1/products?type=variation")}

    result = []
    for p in products:
        variation_rows = []
        for ref in p["variations"]:
            v = variations.get(ref["id"], {})
            prices = v.get("prices", {})
            variation_rows.append(
                {
                    "id": ref["id"],
                    "attributes": {a["name"]: a["value"] for a in ref["attributes"]},
                    "price_minor": int(prices.get("price") or 0),
                    "regular_price_minor": int(prices.get("regular_price") or 0),
                    "sale_price_minor": int(prices.get("sale_price") or 0),
                    "on_sale": v.get("on_sale"),
                    "in_stock": v.get("is_in_stock"),
                    "stock_text": text(v.get("stock_availability", {}).get("text", "")).replace("<span>", "").replace("</span>", ""),
                    "sku": v.get("sku", ""),
                    "image": (v.get("images") or [{}])[0].get("src"),
                }
            )
        prices = p["prices"]
        price_range = prices.get("price_range") or {}
        result.append(
            {
                "id": p["id"],
                "name": text(p["name"]),
                "slug": p["slug"],
                "permalink": p["permalink"],
                "type": p["type"],
                "sku": p["sku"],
                "categories": [c["slug"] for c in p["categories"]],
                "tags": [t["slug"] for t in p["tags"]],
                "attributes": [
                    {
                        "name": a["name"],
                        "taxonomy": a.get("taxonomy"),
                        "used_for_variations": a.get("has_variations"),
                        "terms": [t["name"] for t in a.get("terms", [])],
                    }
                    for a in p["attributes"]
                ],
                "price_minor": int(prices.get("price") or 0),
                "regular_price_minor": int(prices.get("regular_price") or 0),
                "sale_price_minor": int(prices.get("sale_price") or 0),
                "price_range_minor": [int(price_range["min_amount"]), int(price_range["max_amount"])] if price_range else None,
                "currency": prices["currency_code"],
                "currency_minor_unit": prices["currency_minor_unit"],
                "on_sale": p["on_sale"],
                "in_stock": p["is_in_stock"],
                "stock_text": text(p["stock_availability"]["text"]).replace("<span>", "").replace("</span>", ""),
                "sold_individually": p["sold_individually"],
                "review_count": p["review_count"],
                "images": [{"src": i["src"], "alt": i.get("alt", ""), "name": i.get("name", "")} for i in p["images"]],
                "short_description_html_length": len(p["short_description"] or ""),
                "description_html_length": len(p["description"] or ""),
                "variations": variation_rows,
            }
        )
    (OUT / "products.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"products.json: {len(result)} products, {sum(len(r['variations']) for r in result)} variations")

    categories = get_all("/wp-json/wc/store/v1/products/categories")
    rows = [
        {
            "id": c["id"],
            "name": text(c["name"]),
            "slug": c["slug"],
            "parent": c["parent"],
            "count": c["count"],
            "permalink": c["permalink"],
            "image": (c.get("image") or {}).get("src"),
            "description": text(c.get("description", "")),
        }
        for c in categories
    ]
    (OUT / "product-categories.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"product-categories.json: {len(rows)} categories")


def export_content() -> None:
    fields = "id,date,modified,slug,status,link,title,parent,menu_order,author,featured_media,categories,tags,yoast_head_json,content"
    rows = []
    for kind in ("pages", "posts"):
        for item in get_all(f"/wp-json/wp/v2/{kind}?_fields={fields}"):
            yoast = item.get("yoast_head_json") or {}
            content = item["content"]["rendered"]
            rows.append(
                {
                    "kind": kind[:-1],
                    "id": item["id"],
                    "slug": item["slug"],
                    "link": item["link"],
                    "title": text(item["title"]["rendered"]),
                    "parent": item.get("parent", 0),
                    "date": item["date"],
                    "modified": item["modified"],
                    "featured_media": item.get("featured_media"),
                    "categories": item.get("categories", []),
                    "built_with": "elementor" if "data-elementor-type" in content else "block-editor/classic",
                    "content_html_length": len(content),
                    "seo": {
                        "title": text(yoast.get("title", "")),
                        "description": text(yoast.get("description", "")),
                        "canonical": yoast.get("canonical"),
                        "robots": yoast.get("robots"),
                        "og_image": ((yoast.get("og_image") or [{}])[0]).get("url"),
                    },
                }
            )
    (OUT / "content.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"content.json: {len(rows)} pages + posts")

    categories = get_all("/wp-json/wp/v2/categories?_fields=id,name,slug,parent,count,description,link")
    (OUT / "blog-categories.json").write_text(json.dumps(categories, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"blog-categories.json: {len(categories)} categories")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    export_products()
    export_content()
    return 0


if __name__ == "__main__":
    sys.exit(main())
