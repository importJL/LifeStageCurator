"""Deterministic mock provider for local development and tests (uc1_specs.md 2.4)."""

from __future__ import annotations

from .base import InferenceProvider, InferenceResult


class MockProvider(InferenceProvider):
    name = "mock"

    def __init__(self, *, model: str = "mock-model") -> None:
        self.model = model

    async def complete(
        self,
        prompt: str,
        response_schema: dict | None = None,
        *,
        system: str | None = None,
    ) -> InferenceResult:
        if "TASK: ENRICH" in prompt:
            return InferenceResult(
                data={
                    "summary": "Mock summary generated without an external provider call.",
                    "primary_life_stage": "New Parents",
                    "sub_topics": ["Sleep & settling"],
                    "content_type": "article",
                    "estimated_minutes": 8,
                },
                model=self.model,
                tokens_used=106,
            )
        if "TASK: SUMMARY" in prompt:
            return InferenceResult(
                data={"summary": "Mock summary generated without an external provider call."},
                model=self.model,
                tokens_used=42,
            )
        return InferenceResult(
            data={
                "primary_life_stage": "New Parents",
                "sub_topics": ["Sleep & settling"],
                "content_type": "article",
                "estimated_minutes": 8,
            },
            model=self.model,
            tokens_used=64,
        )
