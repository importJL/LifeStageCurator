"""Structured logging and enrichment event records (uc1_specs.md 1.4/2.6)."""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import threading
from datetime import UTC, datetime
from pathlib import Path

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

_log_lock = threading.Lock()


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    handler.addFilter(_RequestIdFilter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())


def log_enrichment(path: Path, record: dict) -> None:
    """Append one JSON line per enrichment request for cost/quality monitoring."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps({"ts": datetime.now(UTC).isoformat(), **record})
        with _log_lock, path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError as exc:  # noqa: BLE001 - logging must never break the request
        logging.getLogger(__name__).warning("could not write enrichment log: %s", exc)
