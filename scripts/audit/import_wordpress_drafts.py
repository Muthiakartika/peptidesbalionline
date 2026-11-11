"""
Adds WordPress DRAFT posts to the blog copy (src/content/blog/), as if they were published, so the
rebuild can show articles that are still waiting for the client's sign-off on the live site.

Drafts have no public page, so export_blog.py can't see them. Their data comes from a file built in
a signed-in wp-admin tab (REST `context=edit` + the logged-in preview page of each draft), saved
outside Git under .data/wordpress/. Each draft becomes the same entries export_blog.py writes for a
published post, built with the same helpers:
  src/content/blog/posts.json        title, dates, categories, picture, card excerpt, Newer/Older, SEO
  src/content/blog/posts/<slug>.json  the post's text (the HTML the preview printed)
  src/content/blog/categories.json   the category archives' post lists and page counts
  src/content/blog/index.ts, files.ts
  src/content/seo/jsonld.json        Yoast's graph and the breadcrumb, with the draft's ?p=<id>
                                     address replaced by its future address /<slug>/

What differs from a published post, on purpose:
  * the article class says status-publish (the preview says status-draft);
  * the card excerpt is computed, because drafts are not on the archive pages: Woodmart cuts the
    stored post text (shortcodes and tags removed) after 135 letters and adds "..." (checked against
    4 published posts on 11 Nov 2026);
  * the entry keeps "wpStatus": "draft" so a later run can tell them apart;
  * with --placeholder-image <slug>, drafts without a featured image borrow that published post's
    picture (post header and card) with a neutral alt text, until WordPress gives them their own
    (owner's request, 11 Nov 2026); the entry says "placeholderImage": <slug>. JSON-LD stays without
    a picture, as Yoast prints it for the draft;
  * the sitemaps are left alone (Yoast lists published posts only).
Once WordPress publishes them, run export_blog.py and export_jsonld.py again: they replace all of this
with the published copy (dates included: WordPress gives a draft its publish time).

Privacy (R-12): the author's public name is an e-mail address and appears in the preview (author link,
Yoast's Person node). It is removed exactly as export_blog.py / export_jsonld.py do; the script stops
before saving if any is left.

Usage (from the project root):
    python scripts/audit/import_wordpress_drafts.py .data/wordpress/peptidesbali-glp-drafts-2026-11-11.json
    python scripts/audit/import_wordpress_drafts.py <file> --placeholder-image best-peptides-for-fat-loss-expert-guide
    python scripts/audit/import_wordpress_drafts.py <file> --dry-run   # only prints what would change
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_blog import OUT, PER_PAGE, ROOT, assert_no_private_data, image, private_data_removed, text, write_index  # noqa: E402
from export_jsonld import EMAIL, GRAVATAR, without_private_data  # noqa: E402

SITE = "https://peptidesbali.online"
EXCERPT_LETTERS = 135  # Woodmart's blog excerpt length on the live site (letters, not words)
CARD_BEFORE, CARD_AFTER = "\n\t\t\t\t\t\t", "\t\t\t\t\t"  # whitespace the archive card prints around it
PLACEHOLDER_ALT = "Molecular model in a research laboratory"  # says what the borrowed picture shows, nothing more


def with_placeholder_image(summary: dict, donor: dict) -> dict:
    """The draft with the donor post's picture (header and card), as WordPress prints a featured image."""
    if not donor.get("image") or not donor["card"].get("image"):
        raise SystemExit(f"{donor['path']} has no picture to borrow")
    classes = summary["articleClass"].split()
    if "has-post-thumbnail" not in classes:
        classes.insert(classes.index("hentry"), "has-post-thumbnail")  # WordPress's order: … format-standard has-post-thumbnail hentry …
    return {
        **summary,
        "articleClass": " ".join(classes),
        "image": {**donor["image"], "alt": PLACEHOLDER_ALT},
        "card": {**summary["card"], "image": {**donor["card"]["image"], "alt": PLACEHOLDER_ALT}},
        "placeholderImage": donor["slug"],
    }


def card_excerpt(raw: str) -> str:
    """Woodmart's excerpt from the stored post text: shortcodes and HTML removed, cut after 135 letters."""
    stripped = re.sub(r"\[caption(.*)\[/caption\]", "", raw, flags=re.I)
    stripped = re.sub(r"\[[^\]]*\]", "", stripped)
    stripped = re.sub(r"<!--.*?-->", "", stripped, flags=re.S)
    stripped = re.sub(r"<[^>]*>", "", stripped)
    cut = stripped[:EXCERPT_LETTERS]
    return CARD_BEFORE + cut + ("..." if len(stripped) >= EXCERPT_LETTERS else "") + CARD_AFTER


def draft_entry(draft: dict) -> tuple[dict, str, list]:
    rest, preview = draft["rest"], draft["preview"]
    if rest["status"] != "draft" or preview["status"] != 200 or not preview["article"]:
        raise SystemExit(f"post {rest['id']}: not a draft with a preview page")
    path = f"/{rest['slug']}/"
    article = BeautifulSoup(preview["article"], "lxml").select_one("article.post-single-page")
    header = article.select_one(".wd-single-post-header")
    content = article.select_one(".wd-entry-content")
    summary = {
        "id": rest["id"],
        "slug": rest["slug"],
        "path": path,
        "title": text(header.select_one("h1")),
        "date": rest["date"],
        "modified": rest["modified"],
        "printed": {
            "published": text(header.select_one(".wd-post-date time")),
            "modified": text(header.select_one(".wd-modified-date time")),
        },
        "categories": rest["categories"],
        "articleClass": " ".join(article.get("class", [])).replace("status-draft", "status-publish"),
        "image": image(header.select_one(".wd-post-image img")),
        "replies": int(text(header.select_one(".wd-replies-count")) or 0),
        "commentsOpen": rest["comment_status"] == "open",
        "newer": None,  # filled in below, from the date order of all posts
        "older": None,
        "seo": {"title": preview["title"], **preview["seo"]},
        # Drafts have no featured image yet; the archive card would show the "large" size of it.
        "card": {"image": None, "excerptHtml": card_excerpt(rest["contentRaw"])},
        "wpStatus": "draft",
    }
    if rest["featured_media"]:
        raise SystemExit(f"{path}: has a featured image now; add its card size before importing")
    html = private_data_removed(content.decode_contents())
    assert_no_private_data(html, path)
    if re.search(r"[?&]p=\d|preview=true|_wpnonce|preview_nonce", html):
        raise SystemExit(f"{path}: the text still has a preview-only address")

    # The draft's address (?p=<id>, also inside "@id"s like ?p=<id>#article) becomes its future one.
    # Replaced after parsing: Yoast writes "/" as "\/" in the JSON text.
    draft_address = re.compile(rf"^{re.escape(SITE)}/\?p={rest['id']}(?=#|$)")

    def readdressed(value):
        if isinstance(value, str):
            return draft_address.sub(f"{SITE}{path}", value)
        if isinstance(value, list):
            return [readdressed(item) for item in value]
        if isinstance(value, dict):
            return {key: readdressed(item) for key, item in value.items()}
        return value

    blocks = []
    for script in preview["ldJson"]:
        raw = script["text"].strip()
        if not raw:
            continue
        data = without_private_data(readdressed(json.loads(raw)))
        if re.search(r"[?&]p=\d", json.dumps(data)):
            raise SystemExit(f"{path}: the structured data still has a draft address")
        blocks.append({"yoast": "yoast-schema-graph" in script["className"].split(), "data": data})
    return summary, html, blocks


def archive_page_seo(first: dict, number: int, total: int) -> dict:
    """Yoast's archive title for page N: "<X> - Page N of M - Atlas Longevity" (page 1 has no page part)."""
    seo = dict(first)
    if number > 1:
        for key in ("title", "ogTitle"):
            base, sep, site = seo[key].rpartition(" - ")
            seo[key] = f"{base} - Page {number} of {total}{sep}{site}"
    return seo


def main() -> int:
    argv = sys.argv[1:]
    placeholder = None
    if "--placeholder-image" in argv:
        i = argv.index("--placeholder-image")
        placeholder = argv[i + 1]
        del argv[i : i + 2]
    args = [a for a in argv if not a.startswith("--")]
    dry_run = "--dry-run" in argv
    if len(args) != 1:
        raise SystemExit(__doc__)
    export = json.loads(Path(args[0]).read_text(encoding="utf-8"))

    posts = json.loads((OUT / "posts.json").read_text(encoding="utf-8"))
    donor = None
    if placeholder:
        donor = next((p for p in posts if p["slug"] == placeholder and "wpStatus" not in p), None)
        if donor is None:
            raise SystemExit(f"--placeholder-image: no published post {placeholder!r}")
    categories = json.loads((OUT / "categories.json").read_text(encoding="utf-8"))
    jsonld = json.loads((ROOT / "src/content/seo/jsonld.json").read_text(encoding="utf-8"))

    draft_ids = {d["rest"]["id"] for d in export["drafts"]}
    published_paths = {p["path"] for p in posts if p["id"] not in draft_ids}
    posts = [p for p in posts if p["id"] not in draft_ids]  # a second run replaces the earlier copy
    texts, new_jsonld = {}, {}
    for draft in export["drafts"]:
        summary, html, blocks = draft_entry(draft)
        if summary["path"] in published_paths:
            raise SystemExit(f"{summary['path']} is already a published post")
        if donor and summary["image"] is None:
            summary = with_placeholder_image(summary, donor)
        posts.append(summary)
        texts[summary["slug"]] = html
        new_jsonld[summary["path"]] = blocks

    # Newer / Older: WordPress links each post to the next one by date, over all posts (checked: this
    # gives exactly the links the live posts print).
    ordered = sorted(posts, key=lambda p: p["date"], reverse=True)
    for i, post in enumerate(ordered):
        newer = ordered[i - 1] if i > 0 else None
        older = ordered[i + 1] if i + 1 < len(ordered) else None
        post["newer"] = {"path": newer["path"], "title": newer["title"]} if newer else None
        post["older"] = {"path": older["path"], "title": older["title"]} if older else None

    # The archives of the drafts' categories: newest first, 10 per page.
    touched = {c for d in export["drafts"] for c in d["rest"]["categories"]}
    by_id = {c["id"]: c for c in categories}
    for category_id in sorted(touched):
        if category_id not in by_id:
            raise SystemExit(f"category {category_id} has no archive in categories.json yet")
        category = by_id[category_id]
        ids = [p["id"] for p in ordered if category_id in p["categories"]]
        total = math.ceil(len(ids) / PER_PAGE)
        first = category["pages"][0]
        category["postIds"] = ids
        category["count"] = len(ids)
        category["pages"] = [{"seo": archive_page_seo(first["seo"], n, total), "title": first["title"]} for n in range(1, total + 1)]

    for path, blocks in new_jsonld.items():
        jsonld[path] = blocks

    print(f"{len(export['drafts'])} drafts; {len(ordered)} posts in all")
    for post in ordered:
        if post["id"] in draft_ids:
            print(f"  + {post['path']} ({len(texts[post['slug']]) // 1024} KB, {len(new_jsonld[post['path']])} JSON-LD blocks)")
    for category_id in sorted(touched):
        c = by_id[category_id]
        print(f"  {c['path']}: {c['count']} posts on {len(c['pages'])} page(s)")
    if dry_run:
        print("Dry run: nothing written.")
        return 0

    posts_out = json.dumps(ordered, ensure_ascii=False, indent=1)
    categories_out = json.dumps(categories, ensure_ascii=False, indent=1)
    jsonld_out = json.dumps(jsonld, ensure_ascii=False, separators=(",", ":"))
    for name, out in (("posts.json", posts_out), ("categories.json", categories_out)):
        assert_no_private_data(out, name)
    if EMAIL.search(jsonld_out.replace("hello@peptidesbali.online", "")) or GRAVATAR.search(jsonld_out):
        raise SystemExit("private data left in the structured data: not saved")

    for slug, html in texts.items():
        (OUT / "posts" / f"{slug}.json").write_text(json.dumps({"html": html}, ensure_ascii=False), encoding="utf-8")
    (OUT / "posts.json").write_text(posts_out, encoding="utf-8")
    (OUT / "categories.json").write_text(categories_out, encoding="utf-8")
    (ROOT / "src/content/seo/jsonld.json").write_text(jsonld_out + "\n", encoding="utf-8")
    write_index(ordered, categories)
    files = [
        "// Generated by scripts/audit/export_blog.py; do not edit by hand.",
        "// Each post's text, by slug; a file is only loaded when its page is built.",
        "export const blogPostFiles = {",
        *[f'  "{p["slug"]}": () => import("./posts/{p["slug"]}.json"),' for p in ordered],
        "} as const;",
        "",
    ]
    (OUT / "files.ts").write_text("\n".join(files), encoding="utf-8")
    print("Written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
