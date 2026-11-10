"""
Exports which products and variations are "on backorder" on the live shop, from WooCommerce's public
Store API (no login, no key): /wp-json/wc/store/v1/products (products and, with type=variation, the
variations). Writes src/content/stock-status.json:

  { "generatedAt": "...", "backorder": { "<product or variation id>": { "notify": true|false } } }

"notify": the product is set to "Allow, but notify customer" (WooCommerce then prints its own
"Available on backorder" line in the cart and an availability text on the product page; the Store API
shows that text). Without it the owner's snippet "Backorder notice in Cart + Mini-cart" prints its badge.
Run:  python scripts/audit/export_stock_status.py
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://peptidesbali.online/wp-json/wc/store/v1/products"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content" / "stock-status.json"


def fetch(query: str) -> list:
    url = f"{BASE}?{query}&_fresh={int(time.time())}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (rebuild audit)"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def all_items(kind: str) -> list:
    items, page = [], 1
    while True:
        batch = fetch(f"per_page=100&page={page}" + ("&type=variation" if kind == "variation" else ""))
        items += batch
        if len(batch) < 100:
            return items
        page += 1
        time.sleep(1)


def main() -> int:
    backorder = {}
    counts = {}
    for kind in ("product", "variation"):
        items = all_items(kind)
        counts[kind] = len(items)
        for item in items:
            if item.get("is_on_backorder"):
                text = (item.get("stock_availability") or {}).get("text") or ""
                backorder[str(item["id"])] = {"notify": bool(text.strip())}
    OUT.write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "backorder": dict(sorted(backorder.items(), key=lambda kv: int(kv[0])))}, indent=2) + "\n", encoding="utf-8")
    print(f"{counts['product']} products, {counts['variation']} variations, {len(backorder)} on backorder -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
