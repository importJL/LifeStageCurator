"""OpenRouter (and compatible router) inference provider (uc1_specs.md 2.4)."""

from __future__ import annotations

import asyncio
import json
import logging
import random

import httpx

from .base import InferenceProvider, InferenceResult, ProviderError

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}
MAX_BACKOFF_SECONDS = 8.0


def _error_detail(response: httpx.Response) -> str:
    """Extract a short provider error message for logs (e.g. upstream rate limits)."""
    try:
        body = response.json()
    except ValueError:
        return ""
    if not isinstance(body, dict):
        return ""
    error = body.get("error")
    if isinstance(error, dict):
        message = (error.get("metadata") or {}).get("raw") or error.get("message")
        return f": {str(message)[:200]}" if message else ""
    if isinstance(error, str):
        return f": {error[:200]}"
    return ""


def _retry_after_seconds(response: httpx.Response) -> float | None:
    value = response.headers.get("retry-after")
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        return None


class OpenRouterProvider(InferenceProvider):
    name = "openrouter"

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        app_url: str | None = None,
        app_name: str | None = None,
        timeout: float = 20.0,
        max_retries: int = 3,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.app_url = app_url
        self.app_name = app_name
        self.timeout = timeout
        self.max_retries = max_retries
        self._client = client

    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.app_url:
            headers["HTTP-Referer"] = self.app_url
        if self.app_name:
            headers["X-Title"] = self.app_name
        return headers

    async def _post(self, payload: dict, client: httpx.AsyncClient) -> dict:
        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            retry_after: float | None = None
            try:
                # Bound each attempt explicitly: some upstreams trickle data and
                # defeat httpx's per-read timeout, starving later retries.
                response = await asyncio.wait_for(
                    client.post(
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                        timeout=self.timeout,
                    ),
                    timeout=self.timeout,
                )
                if response.status_code in RETRYABLE_STATUS:
                    retry_after = _retry_after_seconds(response)
                    raise ProviderError(
                        f"provider returned {response.status_code}{_error_detail(response)}",
                        retryable=True,
                        status_code=response.status_code,
                    )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                last_error = exc
                if exc.response.status_code not in RETRYABLE_STATUS:
                    raise ProviderError(
                        f"provider error {exc.response.status_code}{_error_detail(exc.response)}",
                        status_code=exc.response.status_code,
                    ) from exc
            except httpx.HTTPError as exc:
                last_error = exc
            except TimeoutError as exc:
                last_error = exc
            except ProviderError as exc:
                last_error = exc

            if attempt < self.max_retries - 1:
                if retry_after is not None:
                    backoff = retry_after
                else:
                    backoff = min(MAX_BACKOFF_SECONDS, 1.0 * (2**attempt))
                backoff += random.uniform(0, 0.5)
                detail = str(last_error) or type(last_error).__name__
                logger.warning(
                    "inference retry %s/%s in %.1fs (%s)", attempt + 1, self.max_retries, backoff, detail
                )
                await asyncio.sleep(backoff)

        raise ProviderError(f"inference failed after {self.max_retries} attempts: {last_error}")

    async def complete(
        self,
        prompt: str,
        response_schema: dict | None = None,
        *,
        system: str | None = None,
    ) -> InferenceResult:
        if not self.api_key:
            raise ProviderError("AI_ROUTER_API_KEY is not configured")

        schema_hint = ""
        if response_schema is not None:
            schema_hint = f"\nRespond with a single JSON object matching this schema: {json.dumps(response_schema)}"

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": f"{system}{schema_hint}"})
        messages.append({"role": "user", "content": prompt})

        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
        }
        if response_schema is not None:
            payload["response_format"] = {"type": "json_object"}

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient()
        try:
            try:
                data = await self._post(payload, client)
            except ProviderError as exc:
                # Some models reject JSON mode with a 400; retry once relying on the
                # prompt-enforced schema so the LLM path stays usable (uc1_specs.md 2.4).
                if response_schema is not None and exc.status_code == 400:
                    logger.warning("provider rejected JSON mode (%s); retrying without response_format", exc)
                    payload.pop("response_format", None)
                    data = await self._post(payload, client)
                else:
                    raise
        finally:
            if owns_client:
                await client.aclose()

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("malformed provider response") from exc

        if isinstance(content, dict):
            parsed = content
        else:
            parsed = _loads_json(content)

        usage = data.get("usage") or {}
        return InferenceResult(
            data=parsed,
            model=data.get("model", self.model),
            tokens_used=int(usage.get("total_tokens") or 0),
            raw=data,
        )


def _loads_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(text[start : end + 1])
            except json.JSONDecodeError as nested:
                raise ProviderError("provider did not return valid JSON") from nested
        else:
            raise ProviderError("provider did not return valid JSON") from exc
    if not isinstance(parsed, dict):
        raise ProviderError("provider returned non-object JSON")
    return parsed
