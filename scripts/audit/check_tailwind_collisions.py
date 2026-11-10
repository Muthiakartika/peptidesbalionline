"""
Finds class names in the HTML copied from the live site (src/content/**/*.json: the product pages and
the Elementor pages in src/content/pages/) that are also Tailwind utilities of this project, and
checks that src/app/globals.css neutralises each of them.

Why: the live site has no Tailwind. If a description uses class="flex" and our own code also uses
the "flex" utility, the description would suddenly become a flexbox. globals.css lists those names
in a rule that switches the utilities off inside copied HTML ([data-legacy-html]).

Run it after `npm run build` (or while `npm run dev` has compiled a page), and after re-exporting
the snapshot:
    python scripts/audit/check_tailwind_collisions.py
Exit code 1 means a name is missing from globals.css (the script prints the line to paste).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLASS = re.compile(r"\.((?:\\.|[A-Za-z0-9_-])+)")


def layer_blocks(css: str, layer: str) -> list[str]:
    """The text inside every `@layer <layer> { … }` block (matching braces)."""
    blocks = []
    for match in re.finditer(r"@layer\s+" + layer + r"\s*\{", css):
        depth, start = 1, match.end()
        i = start
        while i < len(css) and depth:
            depth += {"{": 1, "}": -1}.get(css[i], 0)
            i += 1
        blocks.append(css[start : i - 1])
    return blocks


def tailwind_utilities() -> set[str]:
    """Class names Tailwind generated: everything inside its "utilities" layer, in the CSS of the
    last `npm run build` (.next/static) and of `npm run dev` (.next/dev/static)."""
    names: set[str] = set()
    for folder in (ROOT / ".next" / "static", ROOT / ".next" / "dev" / "static"):
        for css_file in folder.rglob("*.css") if folder.exists() else []:
            for block in layer_blocks(css_file.read_text(encoding="utf-8", errors="replace"), "utilities"):
                names.update(re.sub(r"\\(.)", r"\1", m.group(1)) for m in CLASS.finditer(block))
    return names


def copied_html_classes() -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for path in (ROOT / "src" / "content").rglob("*.json"):
        text = json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False).replace('\\"', '"')
        for value in re.findall(r'class="([^"]*)"', text):
            for name in value.split():
                found.setdefault(name, set()).add(path.name)
    return found


def neutralised() -> set[str]:
    css = (ROOT / "src" / "app" / "globals.css").read_text(encoding="utf-8")
    match = re.search(r"\[data-legacy-html\] :is\(([^)]*)\)", css)
    # Names are written as CSS selectors there, so ".text-\[11px\]" means the class "text-[11px]".
    return {re.sub(r"\\(.)", r"\1", name.strip().lstrip(".")) for name in match.group(1).split(",")} if match else set()


def selector(name: str) -> str:
    """A class name as a CSS selector: brackets, slashes, dots, colons and the like escaped."""
    return "." + re.sub(r"([^A-Za-z0-9_-])", r"\\\1", name)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    utilities = tailwind_utilities()
    if not utilities:
        print("No Tailwind CSS found in .next/static. Run `npm run build` (or open a page with `npm run dev`) first.")
        return 2
    collisions = {name: files for name, files in copied_html_classes().items() if name in utilities}
    missing = sorted(set(collisions) - neutralised())
    print(f"{len(collisions)} copied class names are also Tailwind utilities: {', '.join(sorted(collisions)) or 'none'}")
    if missing:
        print("Missing from the [data-legacy-html] rule in src/app/globals.css: " + ", ".join(missing))
        print("Full list to paste: " + ", ".join(selector(n) for n in sorted(set(collisions) | neutralised())))
        return 1
    print("All of them are neutralised in src/app/globals.css.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
