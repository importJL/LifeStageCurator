"""Provider-agnostic inference interface (uc1_specs.md 2.4)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ProviderError(RuntimeError):
    """Raised when an inference provider cannot return a usable response."""

    def __init__(self, message: str, *, retryable: bool = False, status_code: int | None = None) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status_code = status_code


@dataclass
class InferenceResult:
    data: dict
    model: str | None = None
    tokens_used: int = 0
    raw: dict = field(default_factory=dict)


class InferenceProvider(ABC):
    """Abstract provider so OpenRouter-compatible routers can be swapped."""

    name: str = "base"
    model: str | None = None

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        response_schema: dict | None = None,
        *,
        system: str | None = None,
    ) -> InferenceResult:
        """Return structured JSON completing ``prompt``."""
