"""
Snapshot of the live site's Elementor pages (3d: the homepage; 3e: the 52 landing pages; 3f:
/insights/; 3g: the 20 information, legal and affiliate pages), for the rebuilt pages until their
content moves to Sanity (Phase 4). It only READS public pages and files.

Four 3g pages (the affiliate area, login, registration and terms) are plain WordPress pages without
Elementor: for those the content of their <article> is kept instead ("plain": true).

Privacy and security: the forms on these pages carry values that are never saved: WordPress
security tokens (nonces), the reCAPTCHA site key, the visitor's IP address and the page they came
from. Their values are emptied (the fields stay, so the forms look the same), and the script stops
before saving if an IP address or a reCAPTCHA key is left anywhere in a page.

For each page it keeps:
  * the Elementor document exactly as WordPress printed it (sections, columns, widgets), so the
    rebuild can show it with the same markup and the same Elementor CSS;
  * marks on the widgets that the rebuild turns into React components ("islands"):
      - Woodmart product grids  -> the product ids (prices and options then come from the catalogue);
      - the Unlimited Elements carousel -> its Owl Carousel options (read from the page's start script);
      - the remote carousel arrows -> which carousel they drive;
      - Woodmart blog grids (/insights/) -> the widget's options (the posts come from the blog data);
  * the third-party stylesheets the content links (Owl Carousel, Font Awesome, Trustindex reviews),
    copied to public/legacy/vendor/ and linked from there. Fancybox's is left out: the carousel's
    lightbox is switched off (data-lightbox=false), so it styles nothing, and Fancybox 3 needs a
    commercial licence for commercial sites. The Woodmart theme's own stylesheets (e.g. the accordion's)
    are left out too: their rules are rewritten in src/styles/elementor-page.css (see Q-34);
  * the Elementor documents whose CSS the page needs, the theme's title band (when the page has one)
    and the Yoast SEO tags.

Output (generated, do not edit by hand): src/content/pages/<name>.json (one per page),
src/content/pages/index.ts (which page lives at which address), src/content/pages/files.ts (how to
load each page's file), public/legacy/vendor/…

Usage (from the project root):
    python scripts/audit/export_elementor_pages.py                 # every page
    python scripts/audit/export_elementor_pages.py /bpc-157-bali/  # only these pages (the index stays complete)
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_shop_snapshot import SITE, USER_AGENT, fetch, seo  # noqa: E402  (same helpers, same rules)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content" / "pages"
VENDOR = ROOT / "public" / "legacy" / "vendor"

# The pages, by family (docs/audit/page-inventory.md). File name: the path without slashes.
FAMILIES = {
    "home": ["/"],
    "compound": ["/bpc-157-bali/", "/tb-500-bali/", "/semaglutide-bali/", "/tirzepatide-bali/", "/retatrutide-bali/", "/ghk-cu-bali/",
                 "/ghk-cu-bali-2/", "/epitalon-bali/", "/igf-1-lr3-bali/", "/ipamorelin-bali/", "/melanotan-ii-bali/", "/mots-c-bali/",
                 "/nad-bali/", "/cjc-1295-bali/", "/tesamorelin-bali/", "/hgh-bali/"],
    "price": ["/bpc-157-bali-price/", "/tb-500-bali-price/", "/semaglutide-bali-price/", "/tirzepatide-bali-price/",
              "/retatrutide-bali-price/", "/tirzepatide-dosage-guide-bali/"],
    "goal": ["/anti-aging-peptides-bali/", "/cognitive-enhancement-peptides-bali/", "/fat-loss-peptides-bali/",
             "/injury-healing-peptides-bali/", "/libido-peptides-bali/", "/longevity-peptides-bali/", "/muscle-growth-peptides-bali/",
             "/performance-peptides-bali/", "/recovery-peptides-bali/", "/weight-loss-injections-bali/"],
    "bali-area": ["/peptides-bali/", "/peptides-canggu/", "/peptides-seminyak/", "/peptides-ubud/", "/peptides-sanur/",
                  "/peptides-nusa-dua/", "/peptides-uluwatu/", "/peptides-denpasar/", "/peptide-delivery-bali/",
                  "/peptides-bali-same-day-delivery/"],
    "blog": ["/insights/"],
    "city": ["/peptide/", "/peptide/jakarta/", "/peptide/surabaya/", "/peptide/bandung/", "/peptide/medan/", "/peptide/makassar/",
             "/peptide/balikpapan/", "/peptide/batam/", "/peptide/yogyakarta/", "/peptide/lombok/"],
    # 3g: information, legal and affiliate pages. The affiliate area, login, registration and terms
    # are plain WordPress pages (no Elementor): their <article> is copied the same way.
    "info": ["/about-atlas-longevity/", "/contact-peptides-bali/", "/peptides-bali-faq/", "/peptide-consultation-bali/",
             "/lab-results-certificates-of-analysis/", "/rewards/", "/rewards-terms/", "/subscribe/", "/banner/"],
    "legal": ["/privacy-policy/", "/terms-conditions/", "/refund-returns-policy/", "/disclaimer/", "/no-medical-advice-disclaimer/",
              "/abuse-policy/"],
    "affiliate": ["/affiliate-program/", "/affiliate-area/", "/affiliate-login/", "/affiliate-registration/", "/affiliate-terms-of-use/"],
    # The owner's "Atlas Research Planner" tools (a plain page each). The calculator's own script runs
    # as on the live site (see tool_assets below).
    "tools": ["/calculator/"],
}
PAGES = {path: ("home" if path == "/" else path.strip("/").replace("/", "-")) for paths in FAMILIES.values() for path in paths}
# Stylesheets the content links but doesn't use (see above).
UNUSED_STYLESHEETS = {"fancybox-css"}

def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def vendor_name(url: str) -> str:
    """Local file name: wp-content/plugins/<plugin>/…/<file> -> <plugin>/<file>; other hosts ->
    <host>/<file>; uploads -> <file>."""
    parsed = urlparse(url)
    parts = parsed.path.strip("/").split("/")
    if parsed.netloc and parsed.netloc not in urlparse(SITE).netloc:
        return f"{parsed.netloc}/{parts[-1]}"
    return f"{parts[2]}/{parts[-1]}" if len(parts) > 3 and parts[1] == "plugins" else parts[-1]


def vendor_stylesheet(href: str) -> str:
    """Copies a stylesheet the content links (plugin or upload) and every file it references
    (fonts, images), with url(...) rewritten to the local copies. Returns the local path."""
    name = vendor_name(href)
    target = VENDOR / name
    if not target.exists():
        css = download(href).decode("utf-8")

        def local(match: re.Match) -> str:
            ref = match.group(2)
            if ref.startswith("data:"):
                return match.group(0)
            absolute = urljoin(href, ref)
            file = vendor_name(absolute)
            destination = VENDOR / file
            if not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                try:
                    destination.write_bytes(download(absolute.split("#")[0].split("?")[0]))
                except Exception as error:  # a file the CSS names but the server does not have
                    print(f"  skip {absolute}: {error}")
                    return match.group(0)
                time.sleep(0.2)
            return f"url({match.group(1)}/legacy/vendor/{file}{match.group(1)})"

        css = re.sub(r"""url\((['"]?)([^'")]+)\1\)""", local, css)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(css, encoding="utf-8")
        time.sleep(0.3)
    return f"/legacy/vendor/{name}"


def owl_options(soup: BeautifulSoup, carousel_id: str) -> dict:
    """Reads the Owl Carousel options from the widget's start script (a JS object literal)."""
    for script in soup.find_all("script"):
        text = script.get_text()
        if carousel_id not in text or "owlCarousel(" not in text:
            continue
        body = text[text.index("owlCarousel(") + len("owlCarousel("):]
        depth, end = 0, 0
        for i, ch in enumerate(body):
            depth += {"{": 1, "}": -1}.get(ch, 0)
            if depth == 0 and ch == "}":
                end = i + 1
                break
        literal = body[:end]
        literal = re.sub(r"//[^\n]*", "", literal)  # comments
        literal = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', literal)  # keys
        literal = re.sub(r"([{,]\s*)(\d+)\s*:", r'\1"\2":', literal)  # numeric keys (breakpoints)
        literal = literal.replace("'", '"')
        literal = re.sub(r",\s*([}\]])", r"\1", literal)  # trailing commas
        return json.loads(literal)
    raise RuntimeError(f"no Owl Carousel options found for {carousel_id}")


def mark_islands(soup: BeautifulSoup, doc) -> None:
    for widget in doc.select('[data-widget_type="wd_products.default"]'):
        grid = widget.select_one(".products")
        atts = json.loads(grid.get("data-atts") or "{}")
        props = {
            "ids": [int(card["data-id"]) for card in widget.select(".wd-product[data-id]")],
            "gridClass": " ".join(c for c in grid.get("class", [])),
            "gridStyle": grid.get("style") or "",
            "hidden": "wd-hide" in widget.select_one(".wd-products-element").get("class", []),
            # "Recently viewed products": the visitor's own list, filled in the browser.
            "recentlyViewed": atts.get("post_type") == "recently_viewed",
            "limit": int(atts.get("items_per_page") or 0),
            "categories": [int(t) for t in atts.get("taxonomies") or []],
        }
        widget["data-island"] = "product-grid"
        widget["data-island-props"] = json.dumps(props, separators=(",", ":"))
    for carousel in doc.select('.owl-carousel[id^="uc_content_carousel"]'):
        carousel["data-owl-options"] = json.dumps(owl_options(soup, carousel["id"]), separators=(",", ":"))
    for widget in doc.select('[data-widget_type="wd_blog.default"]'):
        grid = widget.select_one(".wd-posts")
        atts = json.loads(grid.get("data-atts") or "{}")
        props = {
            "gridClass": " ".join(grid.get("class", [])),
            "gridStyle": grid.get("style") or "",
            "perPage": int(atts.get("items_per_page") or 12),
            # Which parts of each card the widget shows (Woodmart's "parts_*" options).
            "parts": {name: bool(atts.get(f"parts_{name}")) for name in ("media", "title", "meta", "text", "btn", "published_date")},
            "loadMore": atts.get("pagination") == "more-btn",
        }
        widget["data-island"] = "blog-grid"
        widget["data-island-props"] = json.dumps(props, separators=(",", ":"))
    for arrows in doc.select('[data-widget_type="ucaddon_arrow_navigation.default"]'):
        section = arrows.find_parent(class_="elementor-top-section")
        target = section.select_one('.owl-carousel[id^="uc_content_carousel"]') if section else None
        if target:
            arrows["data-carousel-target"] = target["id"]


def vendor_script(src: str) -> str:
    """Copies a plugin script to public/legacy/vendor/ (without its source-map line, the map file isn't
    copied). Returns the local path."""
    name = vendor_name(src)
    js = download(src).decode("utf-8")
    js = re.sub(r"\n?//# sourceMappingURL=\S+\s*$", "\n", js)
    (VENDOR / name).parent.mkdir(parents=True, exist_ok=True)
    (VENDOR / name).write_text(js, encoding="utf-8")
    return f"/legacy/vendor/{name}"


def tool_assets(soup: BeautifulSoup, container) -> dict:
    """The owner's Atlas Research Planner tools (/calculator/): the widget is drawn in the browser by
    the plugin's own script (GPL-2.0-or-later) from a JSON configuration printed in the page. Both are
    kept: the script is copied to public/legacy/vendor/, the configuration saved with the page (its
    addresses made relative to this site; it holds no token: checked). Phase 6c ports the tool."""
    if not container.select_one("[data-arp-tool]"):
        return {}
    config_tag = soup.select_one("script#arp-tools-config")
    config = json.loads(config_tag.get_text())
    text = json.dumps(config, ensure_ascii=False, separators=(",", ":"))
    if re.search(r"nonce|token|secret", text, re.I):
        raise SystemExit("the tool configuration holds a token: not saved")
    text = text.replace(SITE, "")
    scripts = [
        vendor_script(urljoin(SITE, tag["src"]).split("?")[0])
        for tag in soup.select("script[src]")
        if "/plugins/atlas-research-planner/" in tag["src"]
    ]
    return {"toolConfig": text, "toolScripts": scripts}


def without_tokens(container) -> None:
    """Forms on the live pages carry values that must not be copied: security tokens (WordPress
    nonces), the reCAPTCHA site key, the visitor's own IP address and the address they came from.
    Their values are emptied (the fields stay, so the forms look the same)."""
    for field in container.select('input[type="hidden"]'):
        name = (field.get("name") or "").lower()
        if any(word in name for word in ("nonce", "recaptcha", "remoteip", "referer", "referrer", "_wp_http")):
            field["value"] = ""
    for element in container.select("[data-sitekey]"):
        del element["data-sitekey"]


# What must never be left in a saved page: an IP address, a reCAPTCHA key ("6L" + 38 characters).
LEFTOVERS = re.compile(r"(?<![\d.-])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])|\b6L[0-9A-Za-z_-]{38}\b|data-sitekey")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    unknown = only - set(PAGES)
    if unknown:
        print(f"not in the page list: {sorted(unknown)}")
        return 1
    for path, name in PAGES.items():
        if only and path not in only:
            continue
        html = fetch(path)
        soup = BeautifulSoup(html, "lxml")
        doc = soup.select_one('[data-elementor-type="wp-page"]')
        # A plain WordPress page (no Elementor): its <article> holds the content.
        container = doc if doc else soup.select_one("main#main-content article")
        for link in container.select('link[rel="stylesheet"]'):
            if link.get("id") in UNUSED_STYLESHEETS or "/themes/woodmart" in link["href"]:
                link.decompose()
                continue
            link["href"] = vendor_stylesheet(link["href"])
        mark_islands(soup, container)
        without_tokens(container)
        article = doc.find_parent("article") if doc else container
        data = {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "path": path,
            "family": next(family for family, paths in FAMILIES.items() if path in paths),
            # The Elementor document's id, or the page's own id for a plain page (post-8871 -> 8871).
            "docId": int(doc["data-elementor-id"]) if doc else int(article["id"].split("-")[-1]),
            "articleClass": " ".join(article.get("class", [])) if article else "",
            # The theme's black title band above the content (only on pages with the default
            # template, e.g. /insights/: "Insights", Home / Insights).
            "pageTitleHtml": str(title) if (title := soup.select_one(".wd-page-title")) else "",
            # Elementor documents whose generated CSS the page loads, in the live order.
            "stylesheets": [int(n) for n in dict.fromkeys(re.findall(r"uploads/elementor/css/post-(\d+)\.css", html))],
            # An Elementor page: the document itself; a plain page: what its <article> holds.
            "html": str(doc) if doc else container.decode_contents(),
            "seo": seo(soup),
        }
        if not doc:
            data["plain"] = True
        data.update(tool_assets(soup, container))
        out = json.dumps(data, ensure_ascii=False)
        if leftover := LEFTOVERS.search(out):
            raise SystemExit(f"{path}: private value left at character {leftover.start()}: not saved")
        (OUT / f"{name}.json").write_text(out, encoding="utf-8")
        print(f"{path} -> src/content/pages/{name}.json ({len(data['html']) // 1024} KB, Elementor CSS {data['stylesheets']})")
        time.sleep(0.5)
    write_index()
    return 0


def write_index() -> None:
    """src/content/pages/index.ts: which page lives at which address (small: src/proxy.ts reads it on
    every request); src/content/pages/files.ts: each page's file, loaded only when that page is built."""
    header = "// Generated by scripts/audit/export_elementor_pages.py; do not edit by hand."
    index = [
        header,
        "// The Elementor pages copied from the live site: address -> name (src/content/pages/<name>.json).",
        "export const elementorPageNames = {",
        *[f'  "{path}": "{name}",' for path, name in PAGES.items()],
        "} as const;",
        "",
    ]
    files = [
        header,
        "// Each Elementor page's file, by name; a file is only loaded when its page is built.",
        "export const elementorPageFiles = {",
        *[f'  "{name}": () => import("./{name}.json"),' for name in PAGES.values()],
        "} as const;",
        "",
    ]
    (OUT / "index.ts").write_text("\n".join(index), encoding="utf-8")
    (OUT / "files.ts").write_text("\n".join(files), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
