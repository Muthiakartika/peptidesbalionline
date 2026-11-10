# Elementor CSS of the product descriptions (generated, do not edit)

Made by `python scripts/audit/vendor_elementor_css.py` from the live site's public files.

`post-<id>.css` is the CSS Elementor generated for each of the owner's Elementor documents (the
descriptions and the green buttons block #701). This is the owner's own design data.

A product page links only the files it needs, inside the page rather than in `<head>`
(`src/components/product/ProductPage.tsx`), so they load after every other stylesheet, as on the live
site. Elementor's core CSS (GPL-3.0) and the global "kit" (#7) are in `src/styles/legacy/` and load
first. They all go away when the descriptions are rebuilt as Sanity content (Phase 4).
