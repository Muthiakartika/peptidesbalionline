"""
Snapshot of the live site's blog (Phase 3f): the 54 posts, their 8 categories and what the archive
pages print for each post, for the rebuilt blog until it moves to Sanity (Phase 4). It only READS
public pages and the public REST API.

Privacy: the author's public name on the live site is an e-mail address (risk R-12, question Q-14).
It is never written: the author name and avatar are left out (the rebuild shows a neutral name the
owner can change, see src/lib/blog/author.ts), and any e-mail address or Gravatar hash that appears
in copied HTML is replaced before saving (the script stops if one is left).

Output (generated, do not edit by hand):
  src/content/blog/posts.json       every post without its text: title, dates, categories, pictures,
                                    excerpts, the "Newer" / "Older" links, SEO tags (newest first)
  src/content/blog/posts/<slug>.json  each post's text (the HTML WordPress printed)
  src/content/blog/categories.json  the categories with posts, and the SEO tags of each archive page
  src/content/blog/index.ts         which address is a post (src/proxy.ts reads it on every request)
  src/content/blog/files.ts         how to load each post's text
  src/content/search/pages.json     the 80 pages' WordPress title, date and plain text, for the site
                                    search (/?s=…), which lists pages too

Usage (from the project root):
    python scripts/audit/export_blog.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_shop_snapshot import SITE, fetch, seo  # noqa: E402  (same helpers, same rules)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "content" / "blog"
PER_PAGE = 10  # WordPress "Blog pages show at most" on the live site

EMAIL = re.compile(r"[\w.+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)+")
GRAVATAR = re.compile(r"/avatar/[0-9a-f]{20,}")


def private_data_removed(text: str) -> str:
    text = EMAIL.sub("", text)
    text = GRAVATAR.sub("/avatar/", text)
    text = re.sub(r"/author/[^/\"'\s]+/", "/", text)
    return text


def assert_no_private_data(text: str, where: str) -> None:
    if EMAIL.search(text) or GRAVATAR.search(text) or "/author/" in text:
        raise SystemExit(f"private data left in {where}: not saved")


def api(path: str):
    return json.loads(fetch(path))


def local_path(url: str) -> str:
    """https://peptidesbali.online/what-is-bpc-157/?_fresh=1 -> /what-is-bpc-157/"""
    return urlparse(url).path


def image(img: Tag | None) -> dict | None:
    """An <img>'s attributes with LiteSpeed's lazy loading undone (real src/srcset/sizes)."""
    if img is None:
        return None
    get = lambda name: img.get(f"data-{name}") or img.get(name)  # noqa: E731
    src = get("src")
    if not src or src.startswith("data:"):
        return None
    return {
        "src": src,
        "srcset": get("srcset") or "",
        "sizes": get("sizes") or "",
        "width": int(img.get("width") or 0),
        "height": int(img.get("height") or 0),
        "alt": img.get("alt") or "",
        "className": " ".join(img.get("class", [])),
    }


def text(el: Tag | None) -> str:
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def nav_link(soup: BeautifulSoup, which: str) -> dict | None:
    link = soup.select_one(f".wd-page-nav .{which}-btn a")
    if not link:
        return None
    return {"path": local_path(link["href"]), "title": text(link.select_one(".wd-entities-title"))}


def export_post(post: dict) -> tuple[dict, str]:
    path = local_path(post["link"])
    soup = BeautifulSoup(fetch(path), "lxml")
    article = soup.select_one("article.post-single-page")
    content = article.select_one(".wd-entry-content")
    header = article.select_one(".wd-single-post-header")
    summary = {
        "id": post["id"],
        "slug": post["slug"],
        "path": path,
        "title": text(header.select_one("h1")),
        "date": post["date"],
        "modified": post["modified"],
        # What the page prints, kept to check the dates the rebuild writes (see src/lib/blog/dates.ts).
        "printed": {
            "published": text(header.select_one(".wd-post-date time")),
            "modified": text(header.select_one(".wd-modified-date time")),
        },
        "categories": post["categories"],
        "articleClass": " ".join(article.get("class", [])),
        "image": image(header.select_one(".wd-post-image img")),
        "replies": int(text(header.select_one(".wd-replies-count")) or 0),
        "commentsOpen": post.get("comment_status") == "open",
        "newer": nav_link(soup, "prev"),
        "older": nav_link(soup, "next"),
        "seo": seo(soup),
    }
    html = private_data_removed(content.decode_contents())
    assert_no_private_data(html, path)
    return summary, html


def archive_pages(category: dict) -> list[BeautifulSoup]:
    pages, number = [], 1
    while True:
        path = f"/category/{category['slug']}/" + (f"page/{number}/" if number > 1 else "")
        soup = BeautifulSoup(fetch(path), "lxml")
        pages.append(soup)
        # The archive's pagination lists the page numbers (no "next" arrow here).
        if not any(text(a) == str(number + 1) for a in soup.select(".wd-pagination a.page-numbers")):
            return pages
        number += 1
        time.sleep(0.5)


def main() -> int:
    (OUT / "posts").mkdir(parents=True, exist_ok=True)
    posts = api("/wp-json/wp/v2/posts?per_page=100&_fields=id,date,modified,slug,link,categories,comment_status")
    categories = api("/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug,count,parent")
    summaries = {}
    for post in posts:
        summary, html = export_post(post)
        summaries[post["id"]] = summary
        (OUT / "posts" / f"{post['slug']}.json").write_text(json.dumps({"html": html}, ensure_ascii=False), encoding="utf-8")
        print(f"{summary['path']} ({len(html) // 1024} KB)")
        time.sleep(0.4)

    # What the archive pages print for each post (its card): the picture and the excerpt.
    exported_categories = []
    for category in sorted((c for c in categories if c["count"] > 0), key=lambda c: c["name"]):
        pages = archive_pages(category)
        order = []
        for soup in pages:
            for card in soup.select("article.wd-post"):
                post_id = int(card["id"].split("-")[-1])
                order.append(post_id)
                summary = summaries[post_id]
                summary["card"] = {
                    "image": image(card.select_one(".wd-post-img img")),
                    "excerptHtml": private_data_removed(card.select_one(".wd-post-excerpt").decode_contents()),
                }
        exported_categories.append({
            "id": category["id"],
            "name": category["name"],
            "slug": category["slug"],
            "path": f"/category/{category['slug']}/",
            "count": category["count"],
            "postIds": order,  # as the live archive lists them (newest first)
            "pages": [{"seo": seo(soup), "title": text(soup.select_one(".wd-page-title h1"))} for soup in pages],
        })
        print(f"/category/{category['slug']}/: {len(order)} posts on {len(pages)} pages")

    # The site search (/?s=…) also lists pages: their WordPress title, date and text (plain text
    # only, for matching and the 20-word excerpt WordPress shows), all 80, built or not yet.
    pages = api("/wp-json/wp/v2/pages?per_page=100&_fields=id,date,modified,link,title,content,comment_status")
    search_pages = []
    for page in pages:
        body = BeautifulSoup(page["content"]["rendered"], "lxml")
        for tag in body(["script", "style", "noscript"]):
            tag.decompose()
        # WordPress matches the stored HTML, addresses included ("bali" finds every link to
        # peptidesbali.online): keep the links' and pictures' addresses with the text.
        addresses = " ".join(value for tag in body.find_all(True) for name in ("href", "src", "alt") if (value := tag.get(name)))
        search_pages.append({
            "id": page["id"],
            "title": BeautifulSoup(page["title"]["rendered"], "lxml").get_text(),
            "date": page["date"],
            "modified": page["modified"],
            "path": local_path(page["link"]),
            "commentsOpen": page.get("comment_status") == "open",
            # Tags removed without adding spaces, as WordPress's strip_tags ("Bali</strong>?" -> "Bali?").
            "text": private_data_removed(re.sub(r"\s+", " ", body.get_text("")).strip()),
            "addresses": private_data_removed(addresses),
        })
    (ROOT / "src" / "content" / "search").mkdir(parents=True, exist_ok=True)
    out = json.dumps(sorted(search_pages, key=lambda p: p["date"], reverse=True), ensure_ascii=False)
    assert_no_private_data(out, "search pages")
    (ROOT / "src" / "content" / "search" / "pages.json").write_text(out, encoding="utf-8")
    print(f"search: {len(search_pages)} pages")

    ordered = sorted(summaries.values(), key=lambda p: p["date"], reverse=True)
    for name, data in (("posts.json", ordered), ("categories.json", exported_categories)):
        out = json.dumps(data, ensure_ascii=False, indent=1)
        assert_no_private_data(out, name)
        (OUT / name).write_text(out, encoding="utf-8")
    write_index(ordered, exported_categories)
    files = [
        "// Generated by scripts/audit/export_blog.py; do not edit by hand.",
        "// Each post's text, by slug; a file is only loaded when its page is built.",
        "export const blogPostFiles = {",
        *[f'  "{p["slug"]}": () => import("./posts/{p["slug"]}.json"),' for p in ordered],
        "} as const;",
        "",
    ]
    (OUT / "files.ts").write_text("\n".join(files), encoding="utf-8")
    print(f"{len(ordered)} posts, {len(exported_categories)} categories")
    return 0


def write_index(posts: list[dict], categories: list[dict]) -> None:
    """src/content/blog/index.ts: the posts' addresses and the archive pages that exist (small:
    src/proxy.ts reads it on every request; any other /category/… address gets the 404 page)."""
    archive_pages = [
        category["path"] + (f"page/{n}/" if n > 1 else "") for category in categories for n in range(1, len(category["pages"]) + 1)
    ]
    index = [
        "// Generated by scripts/audit/export_blog.py; do not edit by hand.",
        "// The blog posts' addresses -> their slug (src/content/blog/posts/<slug>.json).",
        "export const blogPostSlugs = {",
        *[f'  "{p["path"]}": "{p["slug"]}",' for p in posts],
        "} as const;",
        "",
        "// Every page of the category archives (/category/<slug>/ and its /page/N/).",
        "export const blogArchivePaths = [",
        *[f'  "{path}",' for path in archive_pages],
        "] as const;",
        "",
    ]
    (OUT / "index.ts").write_text("\n".join(index), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
