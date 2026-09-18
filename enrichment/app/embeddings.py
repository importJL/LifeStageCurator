"""Optional local embeddings for near-duplicate detection (uc1_specs.md 2.5/2.6).

sentence-transformers is an optional dependency (``pip install .[ml]``) so the
core service stays lightweight; when it is unavailable we simply fall back to
exact-URL duplicate detection.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time

logger = logging.getLogger(__name__)


class EmbeddingBackend:
    def __init__(self, *, model_name: str, enabled: bool) -> None:
        self.model_name = model_name
        self.enabled = enabled
        self._model = None
        self._failed = False
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return self.enabled and not self._failed

    def _load(self):
        with self._lock:
            if self._model is not None or self._failed:
                return self._model
            if not self.enabled:
                return None
            try:
                from sentence_transformers import SentenceTransformer

                started = time.perf_counter()
                self._model = SentenceTransformer(self.model_name)
                logger.info(
                    "loaded embedding model %s in %.1fs",
                    self.model_name,
                    time.perf_counter() - started,
                )
            except Exception as exc:  # noqa: BLE001 - optional dependency
                logger.warning("embedding backend unavailable (%s); using exact-URL dedupe only", exc)
                self._failed = True
                self._model = None
            return self._model

    def warmup(self) -> None:
        if self.enabled:
            self._load()

    async def embed(self, text: str) -> list[float] | None:
        if not self.available:
            return None
        model = await asyncio.to_thread(self._load)
        if model is None:
            return None
        vector = await asyncio.to_thread(
            lambda: model.encode(text, normalize_embeddings=True).tolist()
        )
        return vector
