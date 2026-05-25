from __future__ import annotations

from selectolax.parser import HTMLParser


# Tags whose contents we strip entirely (not just the tag).
_DROP_TAGS = (
    "script",
    "style",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "noscript",
    "iframe",
    "svg",
)

# CSS-style selectors of nav/site chrome to drop. Selectolax doesn't support
# every selector — keep these as simple tag-or-class matches.
_DROP_SELECTORS = (
    "header",
    "footer",
    "nav",
    "aside",
    ".ato-header",
    ".ato-footer",
    ".related-links",
    ".breadcrumb",
    "#cookie-banner",
)


def extract_title(html: str) -> str:
    """Return the page title (everything before ' | ' if present)."""
    tree = HTMLParser(html)
    title_node = tree.css_first("title")
    if title_node is None:
        return ""
    raw = title_node.text(strip=True)
    return raw.split("|")[0].strip() if "|" in raw else raw


def clean_html(html: str) -> str:
    """Return a cleaned HTML fragment with chrome stripped.

    Drops nav/footer/script/style/aside. Keeps h1-h6, p, ul, ol, li, table, a.
    """
    tree = HTMLParser(html)
    for selector in _DROP_SELECTORS:
        for node in tree.css(selector):
            node.decompose()
    for tag in _DROP_TAGS:
        for node in tree.css(tag):
            node.decompose()

    main = tree.css_first("main") or tree.css_first("article") or tree.body
    return main.html if main is not None else ""
