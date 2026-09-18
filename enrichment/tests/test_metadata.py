from __future__ import annotations

import pytest

from app.metadata import (
    UnsafeURLError,
    canonicalize_url,
    extract_text,
    parse_html,
    sanitize_url,
)

SAMPLE_HTML = """
<html><head>
  <title>Fallback Title</title>
  <meta property="og:title" content="The calm first-month plan" />
  <meta property="og:description" content="A gentle checklist for the first weeks." />
  <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
  <meta property="og:site_name" content="The Parent Practice" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="2026-02-01T10:00:00Z" />
  <link rel="canonical" href="https://example.com/calm-first-month" />
</head><body>
  <nav>Ignore nav</nav>
  <article><h1>Heading</h1><p>First paragraph about newborn sleep.</p><script>bad()</script></article>
</body></html>
"""


def test_sanitize_rejects_non_http_scheme():
    with pytest.raises(UnsafeURLError):
        sanitize_url("ftp://example.com/file")


@pytest.mark.parametrize("url", ["http://localhost/x", "http://127.0.0.1/x", "http://169.254.1.1/x"])
def test_sanitize_blocks_private_hosts(url):
    with pytest.raises(UnsafeURLError):
        sanitize_url(url)


def test_canonicalize_strips_tracking_and_fragment():
    result = canonicalize_url("HTTPS://Example.com/Path/?utm_source=x&b=2&a=1#section")
    assert result == "https://example.com/Path?a=1&b=2"


def test_canonicalize_removes_trailing_slash():
    assert canonicalize_url("https://example.com/a/") == "https://example.com/a"


def test_parse_html_uses_og_tags():
    meta = parse_html(SAMPLE_HTML, "https://example.com/x")
    assert meta.title == "The calm first-month plan"
    assert meta.description == "A gentle checklist for the first weeks."
    assert meta.thumbnail_url == "https://cdn.example.com/cover.jpg"
    assert meta.site_name == "The Parent Practice"
    assert meta.published_at == "2026-02-01T10:00:00Z"
    assert meta.canonical_url == "https://example.com/calm-first-month"


def test_extract_text_drops_scripts_and_nav():
    text = extract_text(SAMPLE_HTML)
    assert "newborn sleep" in text
    assert "bad()" not in text
    assert "Ignore nav" not in text
