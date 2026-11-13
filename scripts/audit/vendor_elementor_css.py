"""
Copies the stylesheets that the live site's Elementor content needs into the project, so that content
(product descriptions, the green buttons block #701, the homepage) looks exactly the same.

What it writes (generated, do not edit by hand):
  src/styles/legacy/elementor-core.css    Elementor 4.3.5 frontend + the widget styles the content
                                          uses, and the Elementor Pro widget styles (both GPL-3.0,
                                          so they may be copied)
  src/styles/legacy/elementor-kit.css     the global Elementor "kit" (#7): colours, fonts, spacing
  src/styles/legacy/post-<id>.css         the homepage's own Elementor CSS (#7282), imported by its
                                          route before the theme, as on the live site
  public/legacy/elementor/post-<id>.css   the CSS Elementor generated for each of the owner's other
                                          documents: those inside product pages and the 52 landing
                                          pages' own. About 30-75 KB each, so a page links only the
                                          ones it uses.

Order, as on the live site (it decides which rule wins when two are equally strong):
  product pages: 1. Elementor core, 2. the kit, 3. the theme's and the owner's CSS, 4. each
                 description's CSS (linked inside the page, see src/components/product/ProductPage.tsx);
  the homepage:  1. Elementor core, 2. the kit, 3. the page's own CSS (post-7282.css), 4. the theme
                 (all imported in that order by src/app/(store)/page.tsx and ElementorPage.tsx);
  landing pages: 1. Elementor core, 2. the kit, 3. the theme, 4. the page's own CSS, linked inside the
                 page (one file per page can't be imported by a route shared by 52 pages). On the live
                 site 3 and 4 are the other way round; the page's rules are far more specific than the
                 theme's (".elementor-1588 .elementor-element.elementor-element-…"), so the result is
                 the same, which the visual tests check.

Also: src/styles/legacy/affiliate-wp-forms.css, AffiliateWP's form styles (GPL-2.0), which the live
site loads on every page before the theme; the affiliate login and registration forms and the
"please log in" notice use them (imported by src/app/(store)/landing/[name]/page.tsx before the theme).

Not copied: the site footer (#267) and the top-bar marquee (#4118), rebuilt natively in Phase 3a, and
the popups (#5869, #5870, #6534: the age gate is rebuilt natively).

Afterwards it gives every document except the homepage's the homepage's fonts (homepage_typography.py,
the owner's request of 12 Nov 2026); --keep-live-fonts leaves the live site's fonts. Then it gives them the
Atlas colours of the redesign (atlas_palette.py); --keep-live-colours leaves the live site's greys and blacks.

Usage (from the project root, after export_product_pages.py and export_elementor_pages.py):
    python scripts/audit/vendor_elementor_css.py [--keep-live-fonts] [--keep-live-colours]
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

SITE = "https://peptidesbali.online"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
ROOT = Path(__file__).resolve().parents[2]
BUNDLED = ROOT / "src" / "styles" / "legacy"
LINKED = ROOT / "public" / "legacy" / "elementor"

ELEMENTOR = "4.3.5"
PRO = "4.3.2"
AFFILIATE_WP = "2.37.4"
# Elementor's own files, in the order the live homepage loads them.
CORE_FILES = [
    ("elementor/assets/css/frontend.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-divider.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-heading.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-image.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-icon-list.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-image-box.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-icon-box.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-spacer.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-text-editor.min.css", ELEMENTOR),
    ("elementor/assets/lib/animations/styles/e-animation-grow.min.css", ELEMENTOR),
    ("elementor/assets/css/widget-rating.min.css", ELEMENTOR),
    ("pro-elements/assets/css/widget-search.min.css", PRO),
    ("elementor/assets/css/widget-counter.min.css", ELEMENTOR),
    ("elementor/assets/lib/swiper/v8/css/swiper.min.css", "8.4.5"),
    ("elementor/assets/css/conditionals/e-swiper.min.css", ELEMENTOR),
    ("pro-elements/assets/css/widget-testimonial-carousel.min.css", PRO),
    ("pro-elements/assets/css/widget-carousel-module-base.min.css", PRO),
    ("pro-elements/assets/css/widget-gallery.min.css", PRO),
    ("elementor/assets/lib/e-gallery/css/e-gallery.min.css", "1.2.0"),
    ("pro-elements/assets/css/conditionals/transitions.min.css", PRO),
    # 3g: the "Toggle" widget (/affiliate-program/) and the forms (contact, consultation, affiliate).
    ("elementor/assets/css/widget-toggle.min.css", ELEMENTOR),
    ("pro-elements/assets/css/widget-form.min.css", PRO),
    # The popup frame (the homepage's "5% off" popups): Elementor's dialog (its script loads this file
    # when a popup opens) and Elementor Pro's popup styles.
    ("elementor/assets/css/conditionals/dialog.min.css", ELEMENTOR),
    ("pro-elements/assets/css/conditionals/popup.min.css", PRO),
]
KIT = 7
NOT_NEEDED = {267, 4118, 5870, KIT}  # rebuilt natively (footer, marquee, age gate) or bundled (kit)


def get(path: str) -> str | None:
    request = urllib.request.Request(SITE + path, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read().decode("utf-8")
    except Exception as error:  # a widget file that does not exist in this Elementor version
        print(f"  skip {path}: {error}")
        return None


def get_document(doc_id: int) -> str | None:
    for _attempt in range(3):  # big files sometimes arrive cut short
        css = get(f"/wp-content/uploads/elementor/css/post-{doc_id}.css?_fresh={int(time.time())}")
        if css:
            return css
        time.sleep(2)
    return None


def skip_fenced_rule(css: str, start: int, end: int) -> str:
    """Removes the Markdown fence at css[start:end] together with what the browser drops because of
    it: the fence becomes part of the next rule's selector, which makes that selector invalid, so
    the whole rule (up to its closing brace) is ignored. A fence right before "}" or the end of the
    file is dropped alone."""
    rest = re.sub(r"/\*.*?\*/", lambda m: " " * len(m.group()), css[end:], flags=re.S)  # comments keep their length
    if rest.strip() == "" or rest.lstrip()[0] == "}":
        return css[:start] + css[end:]
    open_at = rest.index("{")
    depth = 0
    for i in range(open_at, len(rest)):
        depth += {"{": 1, "}": -1}.get(rest[i], 0)
        if depth == 0:
            return css[:start] + css[end + i + 1:]
    return css[:start]


def bundleable(css: str) -> str:
    """Live CSS that browsers silently skip but Next.js's CSS parser rejects (the whole file). It is
    removed from the bundled files in exactly the way the browser skips it, so nothing changes:
      * an empty block with no selector ("…;}{}h1…"), written by Elementor;
      * a declaration with an Elementor placeholder that was never filled in ("text-align:{{VALUE}}"):
        the browser drops that declaration only;
      * Markdown code fences (```css … ```) pasted into the owner's custom CSS: see skip_fenced_rule."""
    css = re.sub(r"\}\s*\{\s*\}", "}", css)
    css = re.sub(r"[\w-]+\s*:[^;{}]*\{\{[A-Z_]+\}\}[^;{}]*;?", "", css)
    while fence := re.search(r"```[a-z]*", css):
        css = skip_fenced_rule(css, fence.start(), fence.end())
    return css


def main() -> int:
    BUNDLED.mkdir(parents=True, exist_ok=True)
    LINKED.mkdir(parents=True, exist_ok=True)
    missing: list = []

    core = [f"/* Elementor {ELEMENTOR} and Elementor Pro {PRO} (GPL-3.0), copied from the live site by scripts/audit/vendor_elementor_css.py */"]
    for path, version in CORE_FILES:
        css = get(f"/wp-content/plugins/{path}?ver={version}")
        if css:
            if "url(" in css and "url(data:" not in css:
                print(f"  note: {path} references files: {set(re.findall(r'url[(]([^)]*)[)]', css))}")
            core.append(f"/* ---- {path.split('/')[-1]} ---- */\n{css}")
        else:
            missing.append(path)
        time.sleep(0.3)
    (BUNDLED / "elementor-core.css").write_text(bundleable("\n".join(core)) + "\n", encoding="utf-8")

    affiliate = get(f"/wp-content/plugins/affiliate-wp/assets/css/forms.min.css?ver={AFFILIATE_WP}")
    if affiliate:
        header = f"/* AffiliateWP {AFFILIATE_WP} form styles (GPL-2.0), copied from the live site by scripts/audit/vendor_elementor_css.py */"
        (BUNDLED / "affiliate-wp-forms.css").write_text(f"{header}\n{bundleable(affiliate)}\n", encoding="utf-8")
    else:
        missing.append("affiliate-wp forms.min.css")

    kit = get_document(KIT)
    if kit:
        (BUNDLED / "elementor-kit.css").write_text(f"/* Elementor kit #{KIT} (the owner's global Elementor settings), copied by scripts/audit/vendor_elementor_css.py */\n{bundleable(kit)}\n", encoding="utf-8")
    else:
        missing.append(KIT)

    # Elementor pages (src/content/pages/*.json): the homepage's own CSS is bundled; the landing
    # pages' is linked, one file per page (with the product documents below).
    pages = [json.loads(p.read_text(encoding="utf-8")) for p in (ROOT / "src" / "content" / "pages").glob("*.json")]
    page_docs = sorted({page["docId"] for page in pages if page["path"] == "/"})
    landing_docs = {doc for page in pages if page["path"] != "/" for doc in page["stylesheets"]} - NOT_NEEDED - set(page_docs)
    for doc_id in page_docs:
        css = get_document(doc_id)
        if css:
            (BUNDLED / f"post-{doc_id}.css").write_text(f"/* Elementor page #{doc_id}, copied by scripts/audit/vendor_elementor_css.py */\n{bundleable(css)}\n", encoding="utf-8")
        else:
            missing.append(doc_id)

    # Documents inside product pages, and the landing pages' own: linked one by one.
    products = json.loads((ROOT / "src" / "content" / "product-pages.json").read_text(encoding="utf-8"))
    # The homepage's popups (src/content/popups/, by export_popups.py) link their own CSS too.
    popups = {json.loads(p.read_text(encoding="utf-8"))["id"] for p in (ROOT / "src" / "content" / "popups").glob("*.json")}
    ids = sorted((set(products["stylesheets"]) | landing_docs | popups) - NOT_NEEDED - set(page_docs))
    for doc_id in ids:
        css = get_document(doc_id)
        if css:
            (LINKED / f"post-{doc_id}.css").write_text(css, encoding="utf-8")
        else:
            missing.append(doc_id)
        time.sleep(0.3)
    print(f"src/styles/legacy: core ({len(core) - 1} files) + kit + pages {page_docs}; public/legacy/elementor: {len(ids)} documents; missing {missing}")
    # The owner's request of 12 Nov 2026: every page uses the homepage's fonts (homepage_typography.py).
    if "--keep-live-fonts" not in sys.argv:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import homepage_typography

        homepage_typography.main()
    # The redesign of 12 Nov 2026: Atlas colours instead of the live pages' greys and blacks (atlas_palette.py).
    if "--keep-live-colours" not in sys.argv:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import atlas_palette

        atlas_palette.main()
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
