"""
Read-only crawler for the Phase 1 audit of https://peptidesbali.online/.

What it does
------------
1. Reads every URL from the Yoast sitemap index (plus a few known
   noindex pages such as /cart/ and /my-account/).
2. Downloads each page with a normal browser User-Agent (GET only, no forms
   are submitted, nothing is changed on the live site).
3. Extracts the SEO and structure facts the PRD asks for: title, meta
   description, canonical, robots, Open Graph, H1-H6 outline, JSON-LD types,
   breadcrumbs, forms and their field names, images, internal links, and
   which Elementor / Woodmart building blocks the page uses.
4. Writes everything to docs/audit/data/page-inventory.json.

Usage (from the project root)
-----------------------------
    python scripts/audit/crawl_inventory.py

Only the Python standard library is used, so there is nothing to install.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

SITE = "https://peptidesbali.online"
SITEMAP_INDEX = f"{SITE}/sitemap_index.xml"
EXTRA_URLS = [
    "/cart/",
    "/checkout/",
    "/my-account/",
    "/my-account/lost-password/",
    "/affiliate-area/",
    "/subscribe/",
    "/banner/",
    # Deliberately NOT crawling /ref/<username>/ URLs: a real affiliate's link
    # would record a visit in the production AffiliateWP database.
    "/?s=bpc",
    "/?s=bpc&post_type=product",
    "/blog/",
    "/page/2/",
    "/shop/page/2/",
    "/category/peptide-therapy/page/2/",
    "/this-page-does-not-exist-404-check/",
]
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
OUTPUT = Path(__file__).resolve().parents[2] / "docs" / "audit" / "data" / "page-inventory.json"
WORKERS = 3
PAUSE_SECONDS = 0.25


def fetch(url: str) -> tuple[int, str, str]:
    """Download a URL. Returns (status code, final URL after redirects, body)."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, response.geturl(), body
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return error.code, url, body
    except Exception as error:  # network problems are recorded, not fatal
        return 0, url, f"ERROR: {error}"


def sitemap_urls() -> list[str]:
    _, _, index = fetch(SITEMAP_INDEX)
    urls: list[str] = []
    for child in re.findall(r"<loc>([^<]+)</loc>", index):
        _, _, xml = fetch(child)
        for loc in re.findall(r"<loc>([^<]+)</loc>", xml):
            if "/wp-content/" not in loc:
                urls.append(loc)
    return urls


class PageParser(HTMLParser):
    """Collects the facts we care about while walking the HTML once."""

    HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title = ""
        self.meta: dict[str, str] = {}
        self.canonical = ""
        self.hreflang: list[dict] = []
        self.body_classes: list[str] = []
        self.headings: list[dict] = []
        self.jsonld: list[str] = []
        self.forms: list[dict] = []
        self.images: list[dict] = []
        self.iframes: list[str] = []
        self.links: set[str] = set()
        self.external_links: set[str] = set()
        self.elementor_docs: list[dict] = []
        self.class_signals: set[str] = set()
        self._stack_heading: str | None = None
        self._heading_text: list[str] = []
        self._in_title = False
        self._in_jsonld = False
        self._jsonld_buf: list[str] = []
        self._current_form: dict | None = None
        self._in_breadcrumb = 0
        self.breadcrumb_text: list[str] = []

    SIGNALS = {
        "wd-carousel": "carousel",
        "swiper": "swiper-slider",
        "elementor-accordion": "accordion",
        "e-n-accordion": "accordion",
        "elementor-tabs": "tabs",
        "e-n-tabs": "tabs",
        "wd-tabs": "tabs",
        "elementor-testimonial": "testimonials",
        "elementor-counter": "counter",
        "elementor-gallery": "gallery",
        "elementor-widget-form": "elementor-form",
        "elementor-toggle": "toggle",
        "products": "product-grid",
        "wd-products": "product-grid",
        "product-categories": "category-grid",
        "wd-cats": "category-grid",
        "ti-widget": "trustindex-reviews",
        "wd-marquee": "marquee",
        "elementor-video": "video",
        "wd-countdown": "countdown",
        "elementor-icon-box": "icon-box",
        "elementor-image-box": "image-box",
        "wd-blog-holder": "blog-grid",
        "wd-posts": "blog-grid",
        "elementor-posts": "blog-grid",
        "woocommerce-tabs": "product-tabs",
        "variations_form": "variation-form",
        "wd-swatches": "swatches",
        "affwp-form": "affiliatewp-form",
        "affwp-affiliate-dashboard": "affiliatewp-dashboard",
        "g-recaptcha": "recaptcha",
        "gtranslate_wrapper": "gtranslate",
        "joinchat": "whatsapp-joinchat",
        "elementor-widget-html": "custom-html-widget",
        "elementor-widget-shortcode": "shortcode-widget",
        "ue_widget": "unlimited-elements-widget",
        "wd-popup": "woodmart-popup",
        "toc": "table-of-contents",
        "ez-toc": "table-of-contents",
        "rank-math-breadcrumb": "breadcrumbs",
        "wd-breadcrumbs": "breadcrumbs",
        "woocommerce-breadcrumb": "breadcrumbs",
        "yoast-breadcrumb": "breadcrumbs",
        "wd-fbt": "frequently-bought-together",
        "wd-linked-variations": "linked-variations",
        "related-products": "related-products",
        "upsells": "upsells",
        "share": "share-buttons",
        "wd-social-icons": "social-icons",
    }

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        for cls in classes:
            for key, label in self.SIGNALS.items():
                if cls == key or cls.startswith(key + "-") or cls.startswith(key + "_"):
                    self.class_signals.add(label)

        if tag == "title" and not self.title:
            # Only the first <title> is the document title; later ones live
            # inside inline SVG icons (for example the WhatsApp button).
            self._in_title = True
        elif tag == "meta":
            name = a.get("name") or a.get("property")
            if name and "content" in a:
                self.meta[name.lower()] = a["content"]
        elif tag == "link":
            rel = (a.get("rel") or "").lower()
            if rel == "canonical":
                self.canonical = a.get("href", "")
            elif rel == "alternate" and a.get("hreflang"):
                self.hreflang.append({"lang": a["hreflang"], "href": a.get("href")})
        elif tag == "body":
            self.body_classes = classes
        elif tag in self.HEADINGS:
            self._stack_heading = tag
            self._heading_text = []
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._in_jsonld = True
            self._jsonld_buf = []
        elif tag == "form":
            self._current_form = {
                "id": a.get("id"),
                "class": a.get("class"),
                "action": a.get("action"),
                "method": (a.get("method") or "get").lower(),
                "fields": [],
            }
        elif tag in ("input", "select", "textarea") and self._current_form is not None:
            field_type = a.get("type", tag)
            if field_type not in ("hidden",):
                self._current_form["fields"].append(
                    {"tag": tag, "type": field_type, "name": a.get("name"), "required": "required" in a}
                )
            elif a.get("name"):
                self._current_form.setdefault("hidden", []).append(a.get("name"))
        elif tag == "img":
            src = a.get("data-src") or a.get("data-lazy-src") or a.get("src") or ""
            if src and not src.startswith("data:"):
                self.images.append({"src": urljoin(self.base_url, src), "alt": a.get("alt", "")})
        elif tag == "iframe":
            self.iframes.append(a.get("src") or a.get("data-src") or "")
        elif tag == "a" and a.get("href"):
            href = urljoin(self.base_url, a["href"]).split("#")[0]
            host = urlparse(href).netloc
            if host == urlparse(SITE).netloc:
                self.links.add(href)
            elif href.startswith("http"):
                self.external_links.add(href)

        if a.get("data-elementor-type"):
            self.elementor_docs.append(
                {"id": a.get("data-elementor-id"), "type": a.get("data-elementor-type")}
            )

        if any(c in ("woocommerce-breadcrumb", "wd-breadcrumbs", "yoast-breadcrumb") for c in classes) or a.get("id") == "breadcrumbs":
            self._in_breadcrumb += 1
        elif self._in_breadcrumb and tag in ("nav", "div", "p", "span", "a"):
            self._in_breadcrumb += 1 if tag in ("nav", "div", "p") else 0

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag in self.HEADINGS and self._stack_heading == tag:
            text = " ".join("".join(self._heading_text).split())
            if text:
                self.headings.append({"tag": tag, "text": text[:200]})
            self._stack_heading = None
        elif tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            self.jsonld.append("".join(self._jsonld_buf))
        elif tag == "form" and self._current_form is not None:
            self.forms.append(self._current_form)
            self._current_form = None
        elif self._in_breadcrumb and tag in ("nav", "div", "p"):
            self._in_breadcrumb -= 1

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._stack_heading:
            self._heading_text.append(data)
        if self._in_jsonld:
            self._jsonld_buf.append(data)
        if self._in_breadcrumb and data.strip():
            self.breadcrumb_text.append(data.strip())


def jsonld_types(blocks: list[str]) -> list[str]:
    found: list[str] = []

    def walk(node):
        if isinstance(node, dict):
            t = node.get("@type")
            if isinstance(t, list):
                found.extend(t)
            elif t:
                found.append(t)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for block in blocks:
        try:
            walk(json.loads(block))
        except json.JSONDecodeError:
            found.append("INVALID_JSON")
    return sorted(set(found))


def classify(url: str, body_classes: list[str]) -> str:
    c = set(body_classes)
    path = urlparse(url).path
    if "home" in c:
        return "home"
    if "single-product" in c:
        return "product"
    if "tax-product_cat" in c:
        return "product-category"
    if "post-type-archive-product" in c or path.startswith("/shop"):
        return "shop"
    if "woocommerce-cart" in c:
        return "cart"
    if "woocommerce-checkout" in c:
        return "checkout"
    if "woocommerce-account" in c:
        return "account"
    if "single-post" in c:
        return "blog-post"
    if "category" in c or "archive" in c:
        return "blog-archive"
    if "search" in c or "search-results" in c:
        return "search"
    if "error404" in c:
        return "404"
    if "page" in c:
        return "page"
    return "unknown"


def redact(url: str) -> str:
    """Author archive slugs on this site are built from e-mail addresses; keep them out of the docs."""
    return re.sub(r"/author/[^/]+/", "/author/<redacted>/", url)


def visible_word_count(html: str) -> int:
    main = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", html)
    main = re.sub(r"(?is)<header.*?</header>", " ", main)
    main = re.sub(r"(?is)<footer.*?</footer>", " ", main)
    text = re.sub(r"(?s)<[^>]+>", " ", main)
    return len(text.split())


def audit(url: str) -> dict:
    time.sleep(PAUSE_SECONDS)
    status, final_url, html = fetch(url)
    parser = PageParser(final_url)
    try:
        parser.feed(html)
    except Exception as error:
        return {"url": url, "status": status, "error": str(error)}
    uploads = sorted({img["src"] for img in parser.images if "/wp-content/uploads/" in img["src"]})
    missing_alt = sum(1 for img in parser.images if not img["alt"].strip())
    return {
        "url": url,
        "status": status,
        "final_url": final_url,
        "redirected": final_url.rstrip("/") != url.rstrip("/"),
        "type": classify(final_url, parser.body_classes),
        "title": " ".join(parser.title.split()),
        "meta_description": parser.meta.get("description", ""),
        "robots": parser.meta.get("robots", ""),
        "canonical": parser.canonical,
        # Yoast's "Written by" tag (twitter:data1) shows the author's name, which is an e-mail address here.
        "og": {
            k: re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "<redacted-email>", v)
            for k, v in parser.meta.items()
            if k.startswith("og:") or k.startswith("twitter:")
        },
        "hreflang": parser.hreflang,
        "headings": parser.headings,
        "h1_count": sum(1 for h in parser.headings if h["tag"] == "h1"),
        "jsonld_types": jsonld_types(parser.jsonld),
        "breadcrumbs": " > ".join(parser.breadcrumb_text)[:300],
        "forms": parser.forms,
        "image_count": len(parser.images),
        "images_missing_alt": missing_alt,
        "upload_images": uploads,
        "iframes": parser.iframes,
        "elementor_documents": parser.elementor_docs,
        "components": sorted(parser.class_signals),
        "body_classes": parser.body_classes,
        "internal_links": sorted({redact(link) for link in parser.links}),
        "external_links": sorted(parser.external_links),
        "word_count": visible_word_count(html),
        "html_bytes": len(html),
    }


def main() -> int:
    urls = sitemap_urls()
    urls += [SITE + path for path in EXTRA_URLS]
    seen: list[str] = []
    for u in urls:
        if u not in seen:
            seen.append(u)
    print(f"Auditing {len(seen)} URLs with {WORKERS} workers...")
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(audit, seen))

    # URLs linked internally that are not in the sitemap (ignoring query strings
    # and media files) are worth a manual look.
    known = {r["url"].rstrip("/") for r in results}
    discovered = sorted(
        {
            link
            for r in results
            for link in r.get("internal_links", [])
            if "?" not in link
            and "/wp-content/" not in link
            and "/wp-json/" not in link
            and link.rstrip("/") not in known
        }
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "site": SITE,
        "page_count": len(results),
        "linked_but_not_in_sitemap": discovered,
        "pages": results,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
