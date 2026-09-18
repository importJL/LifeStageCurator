"""Best-effort oEmbed lookups for video/podcast providers.

oEmbed gives us authoritative titles, thumbnails and (where available) durations
that feed the estimated time-to-consume in uc1_specs.md 2.2.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

YOUTUBE_RE = re.compile(r"(youtube\.com/watch|youtu\.be/|youtube\.com/shorts/)", re.IGNORECASE)
VIMEO_RE = re.compile(r"vimeo\.com/", re.IGNORECASE)


def detect_provider(url: str) -> str | None:
    if YOUTUBE_RE.search(url):
        return "youtube"
    if VIMEO_RE.search(url):
        return "vimeo"
    return None


def _parse_duration(value: object) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


async def _youtube_duration(url: str, client: httpx.AsyncClient) -> int | None:
    try:
        response = await client.get(url)
        response.raise_for_status()
    except httpx.HTTPError:
        return None
    match = re.search(r'"lengthSeconds":"(\d+)"', response.text)
    if match:
        return int(match.group(1))
    soup = BeautifulSoup(response.text, "lxml")
    meta = soup.find("meta", attrs={"itemprop": "duration"})
    if meta and meta.get("content"):
        iso = re.match(r"PT(?:(\d+)M)?(?:(\d+)S)?", meta["content"])
        if iso:
            minutes = int(iso.group(1) or 0)
            seconds = int(iso.group(2) or 0)
            return minutes * 60 + seconds
    return None


async def fetch_oembed(url: str, *, client: httpx.AsyncClient) -> dict | None:
    """Return an oEmbed payload (plus a normalised duration_seconds) or None."""
    provider = detect_provider(url)
    if provider == "youtube":
        endpoint = f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json"
    elif provider == "vimeo":
        endpoint = f"https://vimeo.com/api/oembed.json?url={quote(url, safe='')}"
    else:
        return None

    try:
        response = await client.get(endpoint)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.debug("oEmbed request failed for %s: %s", url, exc)
        return None

    if not isinstance(payload, dict):
        return None

    duration = _parse_duration(payload.get("duration"))
    if duration is None and provider == "youtube":
        duration = await _youtube_duration(url, client)
    if duration is not None:
        payload["duration_seconds"] = duration
    payload["_provider"] = provider
    return payload
