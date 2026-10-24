"""Streaming chat client for Google's Gemini API via LangChain."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai._common import GoogleGenerativeAIError

from .config import Settings, settings as default_settings


class LLMError(RuntimeError):
    """Raised for any failure that should be surfaced to the user."""


def _to_langchain_messages(messages: Sequence[dict[str, str]]) -> list[BaseMessage]:
    converted: list[BaseMessage] = []
    for message in messages:
        role = message["role"]
        content = message["content"]
        if role == "system":
            converted.append(SystemMessage(content=content))
        elif role == "user":
            converted.append(HumanMessage(content=content))
        elif role == "assistant":
            converted.append(AIMessage(content=content))
        else:
            raise LLMError(f"Unsupported chat message role: {role}")
    return converted


async def stream_chat(
    messages: Sequence[dict[str, str]],
    *,
    settings: Settings | None = None,
) -> AsyncIterator[str]:
    """Yield streamed reply text from the configured Google Gemini model."""
    cfg = settings or default_settings
    if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
        raise LLMError(
            "Google API credentials are missing. Set GOOGLE_API_KEY in the "
            "backend environment or project .env file."
        )

    try:
        model = ChatGoogleGenerativeAI(
            model=cfg.model,
            temperature=0,
            request_timeout=cfg.request_timeout,
        )
        async for chunk in model.astream(_to_langchain_messages(messages)):
            text = chunk.content
            if isinstance(text, list):
                text = "".join(
                    part["text"]
                    for part in text
                    if isinstance(part, dict) and isinstance(part.get("text"), str)
                )
            if text:
                yield text
    except GoogleGenerativeAIError as exc:
        raise LLMError(f"Google Gemini call failed: {exc}") from exc
