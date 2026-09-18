"""URL sanitisation, canonicalisation, HTML fetch and metadata parsing.

Implements uc1_specs.md 2.2 (metadata fetch) and 2.8 (input sanitisation:
http/https only, block private/loopback addresses).
"""

from __future__ import annotations

import ipaddress
import logging
import socket
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup

from .oembed import fetch_oembed

logger = logging.getLogger(__name__)

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "ref_src", "igshid",
}

USER_AGENT = (
    "Mozilla/5.0 (compatible; LifeStageCuratorBot/0.1; +https://lifestagecurator.example/bot)"
)


class UnsafeURLError(ValueError):
    """Raised when a URL is malformed or points at a non-public address."""


@dataclass
class FetchedMetadata:
    url: str
    canonical_url: str | None = None
    title: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    published_at: str | None = None
    site_name: str | None = None
    content_type: str | None = None
    oembed: dict | None = None
    errors: list[str] = field(default_factory=list)


def sanitize_url(url: str) -> str:
    """Validate an http/https URL and reject private/loopback/reserved hosts."""
    candidate = url.strip()
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeURLError(f"unsupported scheme: {parsed.scheme or 'none'}")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("missing host")

    try:
        addresses = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise UnsafeURLError(f"could not resolve host: {host}") from exc

    for info in addresses:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise UnsafeURLError(f"host resolves to a non-public address: {host}")

    return candidate


def canonicalize_url(url: str, *, keep_tracking: bool = False) -> str:
    """Normalise a URL for exact-match duplicate detection."""
    parsed = urlparse(url.strip())
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.hostname.lower() if parsed.hostname else ""
    if parsed.port and not (
        (scheme == "http" and parsed.port == 80) or (scheme == "https" and parsed.port == 443)
    ):
        netloc = f"{netloc}:{parsed.port}"

    query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
    if not keep_tracking:
        query_pairs = [(k, v) for k, v in query_pairs if k.lower() not in TRACKING_PARAMS]
    query_pairs.sort()
    path = parsed.path.rstrip("/") or "/"

    return urlunparse((scheme, netloc, path, "", urlencode(query_pairs), ""))


def _first_meta(soup: BeautifulSoup, *, prop: str | None = None, name: str | None = None) -> str | None:
    attrs = {}
    if prop:
        attrs["property"] = prop
    if name:
        attrs["name"] = name
    tag = soup.find("meta", attrs=attrs)
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def parse_html(html: str, url: str) -> FetchedMetadata:
    soup = BeautifulSoup(html, "lxml")

    title = _first_meta(soup, prop="og:title") or _first_meta(soup, name="twitter:title")
    if not title and soup.title and soup.title.string:
        title = soup.title.string.strip()

    description = (
        _first_meta(soup, prop="og:description")
        or _first_meta(soup, name="description")
        or _first_meta(soup, name="twitter:description")
    )
    thumbnail = _first_meta(soup, prop="og:image") or _first_meta(soup, name="twitter:image")
    site_name = _first_meta(soup, prop="og:site_name")
    published_at = (
        _first_meta(soup, prop="article:published_time")
        or _first_meta(soup, name="article:published_time")
        or _first_meta(soup, name="date")
        or _first_meta(soup, name="pubdate")
    )

    canonical = None
    link = soup.find("link", attrs={"rel": "canonical"})
    if link and link.get("href"):
        canonical = link["href"].strip()
    elif _first_meta(soup, prop="og:url"):
        canonical = _first_meta(soup, prop="og:url")

    og_type = _first_meta(soup, prop="og:type")

    return FetchedMetadata(
        url=url,
        canonical_url=canonical,
        title=title,
        description=description,
        thumbnail_url=thumbnail,
        published_at=published_at,
        site_name=site_name,
        content_type=og_type,
    )


def extract_text(html: str, *, limit: int = 20000) -> str:
    """Best-effort readable text extraction for summarisation and labelling."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "template", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()
    container = soup.find("article") or soup.find("main") or soup.body or soup
    text = " ".join(container.get_text(separator=" ").split())
    return text[:limit]


async def fetch_metadata(
    url: str,
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = 10.0,
    max_chars: int = 20000,
) -> tuple[FetchedMetadata, str]:
    """Fetch a URL and return (metadata, extracted_text). Never raises for network errors."""
    owns_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT}
        )
    try:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text
        meta = parse_html(html, url)
        text = extract_text(html, limit=max_chars)

        try:
            oembed = await fetch_oembed(url, client=client)
        except Exception as exc:  # noqa: BLE001 - oEmbed is best-effort
            logger.debug("oEmbed lookup failed for %s: %s", url, exc)
            oembed = None

        if oembed:
            meta.oembed = oembed
            meta.title = meta.title or oembed.get("title")
            meta.thumbnail_url = meta.thumbnail_url or oembed.get("thumbnail_url")
            meta.site_name = meta.site_name or oembed.get("provider_name")

        return meta, text
    except httpx.HTTPStatusError as exc:
        logger.warning("metadata fetch HTTP error for %s: %s", url, exc)
        return FetchedMetadata(url=url, errors=[f"http_status_{exc.response.status_code}"]), ""
    except httpx.HTTPError as exc:
        logger.warning("metadata fetch network error for %s: %s", url, exc)
        return FetchedMetadata(url=url, errors=["fetch_failed"]), ""
    finally:
        if owns_client:
            await client.aclose()
