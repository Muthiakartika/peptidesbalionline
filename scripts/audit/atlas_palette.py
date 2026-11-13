"""
Gives the Elementor pages copied from the live site the Atlas colours of the redesign (the owner's
request of 12 Nov 2026: the whole site in one look, "Atlas colours, layout of the reference sites").

The landing pages and product descriptions were built with neutral greys (#F7F7F7 bands, #F5F5F5 and
#E9E9E9 boxes, #F2F2F2 cards) and pure black (#000000, #151515) bands, overlays and buttons. Next to the
new shop, product and footer designs (warm cream #FBF7EF / sand #F4ECDD, warm black #17130D) they look
out of place. This script swaps those background colours, keeping any alpha (#F2F2F2D9 → #FBF7EFD9):

    #F7F7F7  #F8F8F8  #F5F5F5  #F2F2F2   →  #FBF7EF   cream
    #F0F0F0                              →  #F7F0E3   light sand
    #E9E9E9                              →  #F4ECDD   sand
    #DEDEDE                              →  #E9DCC2   deep sand
    #000000  #151515                     →  #17130D   warm black

Only `background-color` values change (text and border colours stay). In place and idempotent:
    public/legacy/elementor/post-<id>.css   every document except the homepage's popups (#5869, #6534)
The homepage's own CSS (src/styles/legacy/post-7282.css) is the reference and is never touched.

vendor_elementor_css.py runs it after copying the files from the live site (--keep-live-colours
skips it).

Usage (from the project root):
    python scripts/audit/atlas_palette.py [--dry-run]
"""

from __future__ import annotations

import glob
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINKED = ROOT / "public" / "legacy" / "elementor"
SKIP = {"post-5869.css", "post-6534.css"}

CREAM = "FBF7EF"
SWAPS = {
    "F7F7F7": CREAM,
    "F8F8F8": CREAM,
    "F5F5F5": CREAM,
    "F2F2F2": CREAM,
    "F0F0F0": "F7F0E3",
    "E9E9E9": "F4ECDD",
    "DEDEDE": "E9DCC2",
    "000000": "17130D",
    "151515": "17130D",
}
PATTERN = re.compile(r"(background-color:\s*#)(" + "|".join(SWAPS) + r")([0-9A-Fa-f]{2})?(?![0-9A-Fa-f])", re.IGNORECASE)


def recolour(css: str, counts: Counter) -> str:
    def swap(match: re.Match[str]) -> str:
        old = match.group(2).upper()
        counts[old] += 1
        return f"{match.group(1)}{SWAPS[old]}{match.group(3) or ''}"

    return PATTERN.sub(swap, css)


def main() -> int:
    dry = "--dry-run" in sys.argv
    counts: Counter = Counter()
    changed = 0
    for path in sorted(glob.glob(str(LINKED / "post-*.css"))):
        if Path(path).name in SKIP:
            continue
        css = Path(path).read_text(encoding="utf-8")
        new = recolour(css, counts)
        if new != css:
            changed += 1
            if not dry:
                Path(path).write_text(new, encoding="utf-8")
    summary = ", ".join(f"#{old}->#{SWAPS[old]} x{n}" for old, n in counts.most_common())
    print(f"atlas_palette: {changed} files {'would change' if dry else 'changed'}; {summary or 'nothing to change'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
