"""Short-TTL response cache keyed by URL to avoid repeated LLM calls (uc1_specs.md 2.7)."""

from __future__ import annotations

import threading
import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: int, *, max_entries: int = 500) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        if self.ttl_seconds <= 0:
            return None
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at < now:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any) -> None:
        if self.ttl_seconds <= 0:
            return
        now = time.time()
        with self._lock:
            if len(self._store) >= self.max_entries:
                self._prune(now)
                if len(self._store) >= self.max_entries:
                    oldest = min(self._store, key=lambda k: self._store[k][0])
                    self._store.pop(oldest, None)
            self._store[key] = (now + self.ttl_seconds, value)

    def _prune(self, now: float) -> None:
        expired = [key for key, (expires_at, _) in self._store.items() if expires_at < now]
        for key in expired:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
