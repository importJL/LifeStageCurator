"""Simple in-process sliding-window rate limiter (uc1_specs.md 2.8)."""

from __future__ import annotations

import threading
import time
from collections import deque


class RateLimiter:
    def __init__(self, *, max_requests: int, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        if self.max_requests <= 0:
            return True
        now = time.time()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True
