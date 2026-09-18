from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.providers.base import ProviderError
from app.providers.mock import MockProvider
from app.providers.openrouter import OpenRouterProvider


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _success_payload(content: str) -> dict:
    return {
        "model": "test/model",
        "choices": [{"message": {"content": content}}],
        "usage": {"total_tokens": 123},
    }


async def test_mock_provider_returns_summary():
    result = await MockProvider().complete("TASK: SUMMARY\ncontent", {"type": "object"})
    assert "summary" in result.data


async def test_openrouter_parses_json_content():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_success_payload('{"summary": "Hello"}'))

    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="key",
        model="test/model",
        client=_client(handler),
    )
    result = await provider.complete("prompt", {"type": "object"})
    assert result.data == {"summary": "Hello"}
    assert result.tokens_used == 123
    assert result.model == "test/model"


async def test_openrouter_parses_fenced_json():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_success_payload('```json\n{"summary": "Hi"}\n```'))

    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="key",
        model="test/model",
        client=_client(handler),
    )
    result = await provider.complete("prompt", {"type": "object"})
    assert result.data == {"summary": "Hi"}


async def test_openrouter_retries_then_succeeds():
    calls = {"count": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(200, json=_success_payload('{"summary": "ok"}'))

    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="key",
        model="test/model",
        max_retries=3,
        client=_client(handler),
    )
    result = await provider.complete("prompt", {"type": "object"})
    assert result.data["summary"] == "ok"
    assert calls["count"] == 2


async def test_openrouter_times_out_hanging_attempt_and_retries():
    calls = {"count": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            await asyncio.sleep(0.3)
        return httpx.Response(200, json=_success_payload('{"summary": "ok"}'))

    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="key",
        model="test/model",
        timeout=0.05,
        max_retries=3,
        client=_client(handler),
    )
    result = await provider.complete("prompt", {"type": "object"})
    assert result.data["summary"] == "ok"
    assert calls["count"] == 2


async def test_openrouter_retries_without_json_mode_on_400():
    seen_formats: list[bool] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen_formats.append("response_format" in body)
        if "response_format" in body:
            return httpx.Response(400, json={"error": {"message": "response_format not supported"}})
        return httpx.Response(200, json=_success_payload('{"summary": "ok"}'))

    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="key",
        model="test/model",
        max_retries=2,
        client=_client(handler),
    )
    result = await provider.complete("prompt", {"type": "object"})
    assert result.data["summary"] == "ok"
    assert seen_formats == [True, False]


async def test_openrouter_raises_on_client_error():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="key",
        model="test/model",
        max_retries=2,
        client=_client(handler),
    )
    with pytest.raises(ProviderError):
        await provider.complete("prompt", {"type": "object"})


async def test_openrouter_requires_api_key():
    provider = OpenRouterProvider(
        base_url="https://router.test/api/v1",
        api_key="",
        model="test/model",
    )
    with pytest.raises(ProviderError):
        await provider.complete("prompt", {"type": "object"})
