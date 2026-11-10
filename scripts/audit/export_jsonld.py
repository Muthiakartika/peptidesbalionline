"""
Snapshot of the structured data (JSON-LD) the live site prints on each page: Yoast SEO's graph
(WebPage, BreadcrumbList, WebSite, Organization …) and the owner's own blocks (Product, FAQPage,
Store …), for the 354 pages of docs/audit/data/page-inventory.json that answer 200. The rebuild
prints the same blocks (src/components/seo/JsonLd.tsx) until Phase 4 builds them from Sanity.
It only READS public pages.

Privacy (R-12, Q-14): the blog author's public name on the live site is an e-mail address, and
Yoast's "Person" node repeats it (name, Gravatar picture, author page). That node is replaced by the
neutral author the rebuild shows (src/lib/blog/author.ts: "Atlas Longevity", no picture, no author
page); the script stops before saving if any e-mail address or Gravatar hash is left.

Output (generated, do not edit by hand): src/content/seo/jsonld.json (address -> list of blocks)

Usage (from the project root):
    python scripts/audit/export_jsonld.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_shop_snapshot import fetch  # noqa: E402  (same helper: skips Cloudflare's stale copies)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content" / "seo"
EMAIL = re.compile(r"[\w.+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)+")
GRAVATAR = re.compile(r"gravatar\.com/avatar/[0-9a-f]{20,}")
# The neutral author the rebuild shows on posts (src/lib/blog/author.ts).
AUTHOR_NAME = "Atlas Longevity"


def neutral_person(node: dict) -> dict:
    """Yoast's Person node for the post author, without the e-mail name, picture and author page."""
    kept = {key: node[key] for key in ("@type", "@id") if key in node}
    kept["name"] = AUTHOR_NAME
    return kept


def without_private_data(block):
    if isinstance(block, dict):
        types = block.get("@type")
        if types == "Person" or (isinstance(types, list) and "Person" in types):
            return neutral_person(block)
        cleaned = {key: without_private_data(value) for key, value in block.items()}
        # An article's "author": {"name": <the e-mail name>, "@id": …} gets the neutral name too.
        if isinstance(cleaned.get("author"), dict) and "name" in cleaned["author"]:
            cleaned["author"] = {**cleaned["author"], "name": AUTHOR_NAME}
        return cleaned
    if isinstance(block, list):
        return [without_private_data(item) for item in block]
    return block


def main() -> int:
    inventory = json.loads((ROOT / "docs" / "audit" / "data" / "page-inventory.json").read_text(encoding="utf-8"))
    pages = [page for page in inventory["pages"] if page["status"] == 200 and not page.get("redirected")]
    out: dict[str, list] = {}
    for page in pages:
        path = urlparse(page["url"]).path + (f"?{urlparse(page['url']).query}" if urlparse(page["url"]).query else "")
        soup = BeautifulSoup(fetch(path), "lxml")
        blocks = []
        for script in soup.select('script[type="application/ld+json"]'):
            text = script.get_text().strip()
            if not text:
                continue
            block = without_private_data(json.loads(text))
            # Yoast's graph is marked with a class; keep it so the rebuild prints the same markup.
            blocks.append({"yoast": "yoast-schema-graph" in (script.get("class") or []), "data": block})
        out[path] = blocks
        print(f"{path}: {len(blocks)} block(s)")
        time.sleep(0.4)
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    if EMAIL.search(text.replace("hello@peptidesbali.online", "")) or GRAVATAR.search(text):
        raise SystemExit("private data left in the structured data: not saved")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "jsonld.json").write_text(text + "\n", encoding="utf-8")
    print(f"{len(out)} pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
