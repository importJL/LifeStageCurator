"""Duplicate detection: exact canonical-URL match plus optional embedding similarity.

Implements uc1_specs.md 2.2 (duplicate detection) and 2.7 (URL index/embeddings).
Uses SQLite so the store persists across restarts without requiring the main
application's PostgreSQL database; swap to pgvector when that lands.
"""

from __future__ import annotations

import json
import logging
import math
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from .models import DuplicateMatch

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS content_index (
    content_id TEXT PRIMARY KEY,
    canonical_url TEXT UNIQUE,
    url TEXT,
    title TEXT,
    embedding TEXT,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_canonical_url ON content_index (canonical_url);
"""


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right, strict=False))
    norm_left = math.sqrt(sum(a * a for a in left))
    norm_right = math.sqrt(sum(b * b for b in right))
    if norm_left == 0 or norm_right == 0:
        return 0.0
    return dot / (norm_left * norm_right)


class DuplicateStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def find_exact(self, canonical_url: str, *, exclude_content_id: str | None = None) -> DuplicateMatch | None:
        if not canonical_url:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT content_id, url FROM content_index WHERE canonical_url = ?",
                (canonical_url,),
            ).fetchone()
        if row is None or row["content_id"] == exclude_content_id:
            return None
        return DuplicateMatch(
            content_id=row["content_id"],
            similarity=1.0,
            url=row["url"],
            reason="exact_url",
        )

    def find_near(
        self,
        embedding: list[float] | None,
        *,
        threshold: float,
        exclude_content_id: str | None = None,
        limit: int = 5,
    ) -> list[DuplicateMatch]:
        if not embedding:
            return []
        with self._lock:
            rows = self._conn.execute(
                "SELECT content_id, url, embedding FROM content_index WHERE embedding IS NOT NULL"
            ).fetchall()

        matches: list[DuplicateMatch] = []
        for row in rows:
            if row["content_id"] == exclude_content_id:
                continue
            try:
                stored = json.loads(row["embedding"])
            except (TypeError, ValueError):
                continue
            similarity = cosine_similarity(embedding, stored)
            if similarity >= threshold:
                matches.append(
                    DuplicateMatch(
                        content_id=row["content_id"],
                        similarity=round(similarity, 4),
                        url=row["url"],
                        reason="near_duplicate",
                    )
                )
        matches.sort(key=lambda match: match.similarity, reverse=True)
        return matches[:limit]

    def record(
        self,
        *,
        content_id: str,
        url: str | None,
        canonical_url: str | None,
        title: str | None,
        embedding: list[float] | None = None,
    ) -> None:
        now = datetime.now(UTC).isoformat()
        payload = json.dumps(embedding) if embedding else None
        with self._lock:
            existing = None
            if canonical_url:
                existing = self._conn.execute(
                    "SELECT content_id FROM content_index WHERE canonical_url = ?",
                    (canonical_url,),
                ).fetchone()

            if existing is not None:
                # Same URL re-enriched: update the indexed row and keep its content id.
                self._conn.execute(
                    """
                    UPDATE content_index
                    SET url = ?, title = ?, embedding = COALESCE(?, embedding), updated_at = ?
                    WHERE content_id = ?
                    """,
                    (url, title, payload, now, existing["content_id"]),
                )
            else:
                self._conn.execute(
                    """
                    INSERT INTO content_index (content_id, canonical_url, url, title, embedding, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(content_id) DO UPDATE SET
                        canonical_url = excluded.canonical_url,
                        url = excluded.url,
                        title = excluded.title,
                        embedding = COALESCE(excluded.embedding, content_index.embedding),
                        updated_at = excluded.updated_at
                    """,
                    (content_id, canonical_url, url, title, payload, now),
                )
            self._conn.commit()

    def count(self) -> int:
        with self._lock:
            row = self._conn.execute("SELECT COUNT(*) AS count FROM content_index").fetchone()
        return int(row["count"])
