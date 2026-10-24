"""Streaming client for a local Ollama server.

Ollama's native `/api/chat` endpoint returns newline-delimited JSON, one object
per token. We turn that into a plain async iterator of text deltas so the HTTP
layer can forward them over SSE.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence

import httpx

from .config import Settings, settings as default_settings


class LLMError(RuntimeError):
    """Raised for any failure that should be surfaced to the user."""


def _friendly_status_error(status: int, body: str, model: str, base_url: str) -> str:
    detail = ""
    try:
        detail = json.loads(body).get("error", "")
    except (ValueError, AttributeError):
        detail = body.strip()

    if status == 404:
        return (
            f"Model '{model}' is not available on Ollama at {base_url}. "
            f"Run `ollama pull {model}` or set OLLAMA_MODEL to a model you have. "
            f"{detail}".strip()
        )
    return f"Ollama returned HTTP {status}. {detail}".strip()


async def stream_chat(
    messages: Sequence[dict[str, str]],
    *,
    settings: Settings | None = None,
) -> AsyncIterator[str]:
    """Yield response text deltas from Ollama for the given chat messages."""
    cfg = settings or default_settings
    payload = {
        "model": cfg.model,
        "messages": list(messages),
        "stream": True,
        "options": {"temperature": 0.7},
    }

    timeout = httpx.Timeout(cfg.request_timeout, connect=10.0)
    url = f"{cfg.ollama_base_url}/api/chat"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    body = (await response.aread()).decode("utf-8", "replace")
                    raise LLMError(
                        _friendly_status_error(
                            response.status_code, body, cfg.model, cfg.ollama_base_url
                        )
                    )

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except ValueError:
                        continue

                    if chunk.get("error"):
                        raise LLMError(str(chunk["error"]))

                    delta = (chunk.get("message") or {}).get("content") or ""
                    if delta:
                        yield delta
                    if chunk.get("done"):
                        break
    except httpx.ConnectError as exc:
        raise LLMError(
            f"Could not reach Ollama at {cfg.ollama_base_url}. "
            "Start it with `ollama serve` and check OLLAMA_BASE_URL."
        ) from exc
    except httpx.TimeoutException as exc:
        raise LLMError(
            f"Ollama did not respond within {cfg.request_timeout:.0f}s."
        ) from exc


async def list_models(*, settings: Settings | None = None) -> list[str]:
    """Return the model names the Ollama server has pulled."""
    cfg = settings or default_settings
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
        response = await client.get(f"{cfg.ollama_base_url}/api/tags")
        response.raise_for_status()
        payload = response.json()
    return [model["name"] for model in payload.get("models", []) if model.get("name")]
