"""
Gives every Elementor page the homepage's font format (the owner's request of 12 Nov 2026: "fonts for
the new site can we follow the same format as the homepage").

The homepage's format (measured on src/styles/legacy/post-7282.css and the rendered page):
  big headings (every H1, and headings of 28px and more)  Anton, weight 500 (an H1: 600, uppercase),
                                                          letter spacing 1.11px; the gold italic
                                                          words stay italic (they are <i> in the HTML)
  everything else: smaller headings, text, lists, FAQ     Inter, with the page's own size, weight and
  questions, buttons, labels, form fields                 spacing
  numbers and large accent text (counters, prices like    Anton (or Cormorant Garamond where the page
  "100,000 IDR", "1,248")                                 already uses it, as the homepage's counters)

The other pages used Urbanist (the 52 landing pages, the product descriptions), Cormorant Garamond
headings (/hgh-bali/, /rewards/, the consultation, lab results and affiliate pages), Inter Tight,
Poppins (the legal pages), Montserrat, Roboto (Elementor's default for widgets without their own font)
and Times New Roman.

What it changes, in place (idempotent: a second run changes nothing):
  public/legacy/elementor/post-<id>.css   every document except the homepage's own popups (#5869 and
                                          its sign-up form #6534)
  src/styles/legacy/elementor-kit.css     the kit's global fonts (Roboto): headings Anton, text and
                                          buttons Inter. Widgets without their own font use them,
                                          also the ones an editor adds in Sanity.
The homepage's CSS (src/styles/legacy/post-7282.css) is the reference and is never touched.

vendor_elementor_css.py runs it after copying the files from the live site, so a fresh copy keeps the
format. To see the live site's fonts again, run the vendor script with --keep-live-fonts.

Usage (from the project root):
    python scripts/audit/homepage_typography.py [--dry-run]
"""

from __future__ import annotations

import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINKED = ROOT / "public" / "legacy" / "elementor"
KIT_FILE = ROOT / "src" / "styles" / "legacy" / "elementor-kit.css"

# The homepage's own documents: its popups ("Get 5% off" and the sign-up form it opens) belong to the
# homepage's format already. Popups are only shown on the homepage (src/content/popups/).
HOMEPAGE_DOCS = {7282, 5869, 6534}

# Fonts the homepage uses for page content; rules in them are left alone.
HOMEPAGE_FONTS = {"Anton", "Inter", "Jost"}
# Text fonts the other pages use, converted here. Anything else (icon fonts) is left alone.
CONVERTED_FONTS = {"Urbanist", "Cormorant Garamond", "Inter Tight", "Poppins", "Montserrat", "Roboto", "Roboto Slab", "Times New Roman"}

DISPLAY_MIN_PX = 28  # headings this big are Anton on the homepage; smaller ones are Inter
ACCENT_MIN_PX = 22  # Cormorant text this big (numbers, accent lines) stays Cormorant, as on the homepage
DISPLAY_LETTER_SPACING = "1.11px"
DISPLAY = '"Anton", Sans-serif'
TEXT = '"Inter", Sans-serif'

# The part of a selector that holds a heading's text.
HEADING_PARTS = re.compile(
    r"(elementor-heading-title|elementor-icon-box-title|elementor-image-box-title|elementor-toggle-title|"
    r"elementor-tab-title|e-n-accordion-item-title|wd-accordion-title|ue_heading_title|elementor-cta__title)"
)
# Text kept in Cormorant when it is big enough: counters and plain text (prices, numbers, accent lines).
ACCENT_PARTS = re.compile(r"(elementor-counter-number|elementor-testimonial__text|elementor-icon-box-description|^\.elementor-element\.elementor-element-[0-9a-f]+$)")

FAMILY = re.compile(r'(?<![-\w])font-family\s*:\s*"([^"]+)"[^;}]*')
SIZE = re.compile(r"(?<![-\w])font-size\s*:\s*([\d.]+)px")
WEIGHT = re.compile(r"(?<![-\w])font-weight\s*:[^;}]*")
SPACING = re.compile(r"(?<![-\w])letter-spacing\s*:[^;}]*")
TRANSFORM = re.compile(r"(?<![-\w])text-transform\s*:[^;}]*")


def heading_tags() -> dict[str, str]:
    """Element id -> heading level of each heading widget, from the pages' HTML (local copies; Sanity
    keeps the same ids). An id used on several documents counts as an H1 if it is one anywhere."""
    sources: list[str] = []
    for path in glob.glob(str(ROOT / "src" / "content" / "pages" / "*.json")):
        sources.append(json.loads(Path(path).read_text(encoding="utf-8")).get("html", ""))
    products = json.loads((ROOT / "src" / "content" / "product-pages.json").read_text(encoding="utf-8"))
    sources += list(products["blocks"].values())
    sources += [json.dumps(page, ensure_ascii=False).replace('\\"', '"') for page in products["pages"].values()]
    tags: dict[str, str] = {}
    widget = re.compile(r'elementor-element-([0-9a-f]+)[^"]*"[^>]*data-widget_type="heading\.default"[^>]*>(?:\s|\\n)*<(h[1-6]|p|div|span)\b')
    for html in sources:
        for element_id, tag in widget.findall(html):
            if tags.get(element_id) != "h1":
                tags[element_id] = tag
    return tags


def rules(css: str):
    """Yields (selector, body start, body end, inside a media query) for every rule that holds
    declarations, skipping comments and @keyframes."""
    stack: list[tuple[str, int, str]] = []
    prelude = 0
    i = 0
    while i < len(css):
        if css.startswith("/*", i):
            end = css.find("*/", i + 2)
            i = len(css) if end < 0 else end + 2
            prelude = i if not stack or stack[-1][0] != "rule" else prelude
            continue
        char = css[i]
        if char == "{":
            head = css[prelude:i].strip()
            if head.startswith("@"):
                stack.append(("keyframes" if "keyframes" in head else "group", i + 1, head))
            elif stack and stack[-1][0] == "keyframes":
                stack.append(("frame", i + 1, head))
            else:
                stack.append(("rule", i + 1, head))
            prelude = i + 1
        elif char == "}":
            if stack:
                kind, start, head = stack.pop()
                if kind == "rule":
                    yield head, start, i, any(k == "group" for k, _, _ in stack)
            prelude = i + 1
        i += 1


def element_id(selector: str) -> str | None:
    found = re.findall(r"elementor-element-([0-9a-f]+)", selector)
    return found[-1] if found else None


def last_part(selector: str) -> str:
    return selector.split(",")[0].strip().split(" ")[-1]


def classify(selector: str, family: str, size: float | None, tags: dict[str, str]) -> str:
    """'display' (Anton heading), 'display-h1', 'number' (Anton, plain weight), 'accent' (stays
    Cormorant) or 'text' (Inter)."""
    part = last_part(selector)
    if HEADING_PARTS.search(part):
        tag = tags.get(element_id(selector) or "", "")
        if tag == "h1":
            return "display-h1"
        if size is not None and size >= DISPLAY_MIN_PX:
            return "display"
        return "text"
    if family == "Cormorant Garamond" and size is not None and size >= ACCENT_MIN_PX and ACCENT_PARTS.search(part):
        return "accent"
    if size is not None and size >= DISPLAY_MIN_PX and ACCENT_PARTS.search(part):
        return "number"
    return "text"


def set_declaration(body: str, pattern: re.Pattern, declaration: str) -> str:
    if pattern.search(body):
        return pattern.sub(declaration, body, count=1)
    return body.rstrip(";") + ";" + declaration + ";" if body.strip() else declaration + ";"


def rewrite(body: str, role: str, declares_family: bool) -> str:
    if role == "accent":
        return body
    if role in ("display", "display-h1"):
        if declares_family:
            body = FAMILY.sub(f"font-family:{DISPLAY}", body, count=1)
            body = set_declaration(body, WEIGHT, "font-weight:600" if role == "display-h1" else "font-weight:500")
            if role == "display-h1":
                body = set_declaration(body, TRANSFORM, "text-transform:uppercase")
            body = set_declaration(body, SPACING, f"letter-spacing:{DISPLAY_LETTER_SPACING}")
        elif SPACING.search(body):
            # A tablet/phone rule of the same heading: keep the homepage's spacing at every width.
            body = SPACING.sub(f"letter-spacing:{DISPLAY_LETTER_SPACING}", body, count=1)
        return body
    if role == "number":
        if declares_family:
            body = FAMILY.sub(f"font-family:{DISPLAY}", body, count=1)
            body = set_declaration(body, WEIGHT, "font-weight:400")
        return body
    if declares_family:
        body = FAMILY.sub(f"font-family:{TEXT}", body, count=1)
    return body


def convert(css: str, tags: dict[str, str], stats: Counter) -> str:
    found = list(rules(css))
    # Roles come from each selector's main (desktop) rule; its tablet and phone rules follow it.
    roles: dict[str, str] = {}
    for selector, start, end, in_media in found:
        body = css[start:end]
        family = FAMILY.search(body)
        if in_media or not family or family.group(1) not in CONVERTED_FONTS:
            continue
        size = SIZE.search(body)
        roles[selector] = classify(selector, family.group(1), float(size.group(1)) if size else None, tags)
        stats[(family.group(1), roles[selector])] += 1
    out: list[str] = []
    cursor = 0
    for selector, start, end, in_media in found:
        body = css[start:end]
        family = FAMILY.search(body)
        declares = bool(family and family.group(1) in CONVERTED_FONTS)
        role = roles.get(selector)
        if role is None and declares:
            # A font set only for tablets or phones.
            size = SIZE.search(body)
            role = classify(selector, family.group(1), float(size.group(1)) if size else None, tags)
            stats[(family.group(1), role + " (media only)")] += 1
        if role is None or (in_media and not declares and role not in ("display", "display-h1")):
            continue
        new_body = rewrite(body, role, declares)
        if new_body != body:
            out.append(css[cursor:start])
            out.append(new_body)
            cursor = end
    out.append(css[cursor:])
    return "".join(out)


def convert_kit(css: str) -> str:
    """The kit's global fonts: headings (primary) Anton 500, text and the rest Inter."""
    values = {
        "primary-font-family": '"Anton"',
        "primary-font-weight": "500",
        "secondary-font-family": '"Inter"',
        "text-font-family": '"Inter"',
        "accent-font-family": '"Inter"',
    }
    for name, value in values.items():
        css = re.sub(rf"(--e-global-typography-{name}:)[^;}}]*", rf"\g<1>{value}", css)
    return css


def main(dry_run: bool = False) -> int:
    tags = heading_tags()
    stats: Counter = Counter()
    changed = 0
    for path in sorted(LINKED.glob("post-*.css")):
        doc_id = int(re.search(r"post-(\d+)", path.name).group(1))
        if doc_id in HOMEPAGE_DOCS:
            continue
        css = path.read_text(encoding="utf-8")
        new = convert(css, tags, stats)
        if new != css:
            if not dry_run:
                path.write_text(new, encoding="utf-8")
            changed += 1
    kit = KIT_FILE.read_text(encoding="utf-8")
    new_kit = convert_kit(kit)
    if new_kit != kit:
        if not dry_run:
            KIT_FILE.write_text(new_kit, encoding="utf-8")
        changed += 1
    for (family, role), count in sorted(stats.items()):
        print(f"  {family:20} -> {role:22} {count}")
    print(f"homepage typography: {changed} files {'would change' if dry_run else 'changed'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(dry_run="--dry-run" in sys.argv))
