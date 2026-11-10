"""
Snapshot of the live site's XML sitemaps (Yoast SEO): /sitemap_index.xml and its five parts
(post-, page-, product-, category- and product_cat-sitemap.xml), with each address, its "last
modified" date and the pictures Yoast lists for it. The rebuild serves the same sitemaps from this
snapshot (src/lib/seo/sitemaps.ts, routes src/app/*sitemap*.xml/) until Phase 4 builds them from
Sanity. It only READS public files.

Output (generated, do not edit by hand): src/content/seo/sitemaps.json

Usage (from the project root):
    python scripts/audit/export_sitemaps.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_shop_snapshot import SITE, fetch  # noqa: E402  (same helpers, same rules)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content" / "seo"
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "image": "http://www.google.com/schemas/sitemap-image/1.1"}
EMAIL = re.compile(r"[\w.+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)+")


def local_path(url: str) -> str:
    """https://peptidesbali.online/what-is-bpc-157/ -> /what-is-bpc-157/ (the site's own pages only)."""
    if not url.startswith(SITE + "/"):
        raise SystemExit(f"address outside the site in a sitemap: {url}")
    return urlparse(url).path


def main() -> int:
    index = ET.fromstring(fetch("/sitemap_index.xml"))
    parts = []
    sitemaps = {}
    for entry in index.findall("s:sitemap", NS):
        url = entry.findtext("s:loc", namespaces=NS)
        name = local_path(url).strip("/").removesuffix("-sitemap.xml")
        parts.append({"name": name, "lastmod": entry.findtext("s:lastmod", namespaces=NS)})
        time.sleep(0.5)
        urlset = ET.fromstring(fetch(f"/{name}-sitemap.xml"))
        sitemaps[name] = [
            {
                "path": local_path(item.findtext("s:loc", namespaces=NS)),
                "lastmod": item.findtext("s:lastmod", namespaces=NS),
                # Pictures stay on the live site's address until Phase 4 moves them (same paths).
                "images": [image.findtext("image:loc", namespaces=NS) for image in item.findall("image:image", NS)],
            }
            for item in urlset.findall("s:url", NS)
        ]
        print(f"/{name}-sitemap.xml: {len(sitemaps[name])} addresses, {sum(len(u['images']) for u in sitemaps[name])} pictures")
    data = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "index": parts, "sitemaps": sitemaps}
    out = json.dumps(data, ensure_ascii=False, indent=1)
    if EMAIL.search(out):
        raise SystemExit("an e-mail address in the sitemaps: not saved")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "sitemaps.json").write_text(out + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
