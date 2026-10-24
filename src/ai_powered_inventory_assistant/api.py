"""HTTP API for the chat UI.

POST /api/chat/stream  -> text/event-stream of JSON events:
                          {"type": "delta", "text": "..."}
                          {"type": "done",  "text": "<full reply>", "model": "..."}
                          {"type": "error", "message": "..."}
POST /api/chat         -> single JSON reply (fallback for clients without
                          streaming fetch support, e.g. React Native's fetch)
GET  /api/health       -> backend + Ollama status
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Literal

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from . import llm
from .config import settings

logger = logging.getLogger("inventory_assistant.api")

app = FastAPI(title="AI Powered Inventory Assistant API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)

    @field_validator("messages")
    @classmethod
    def _last_message_is_from_user(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        if messages[-1].role != "user":
            raise ValueError("the last message must have role 'user'")
        return messages


def _build_prompt(messages: list[ChatMessage]) -> list[dict[str, str]]:
    """Prepend the system prompt and trim history to the configured window."""
    history = [message.model_dump() for message in messages][
        -settings.max_history_messages :
    ]
    return [{"role": "system", "content": settings.system_prompt}, *history]


def _sse(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _event_stream(prompt: list[dict[str, str]]) -> AsyncIterator[str]:
    parts: list[str] = []
    try:
        async for delta in llm.stream_chat(prompt):
            parts.append(delta)
            yield _sse({"type": "delta", "text": delta})
    except llm.LLMError as exc:
        logger.warning("LLM error: %s", exc)
        yield _sse({"type": "error", "message": str(exc)})
        return
    yield _sse({"type": "done", "text": "".join(parts), "model": settings.model})


@app.get("/api/health")
async def health() -> dict[str, object]:
    """Best-effort status probe, used by the UI to show the connection badge."""
    models: list[str] = []
    reachable = False
    try:
        models = await llm.list_models()
        reachable = True
    except (httpx.HTTPError, OSError, ValueError):
        pass
    return {
        "status": "ok",
        "model": settings.model,
        "ollama": {
            "base_url": settings.ollama_base_url,
            "reachable": reachable,
            "models": models,
        },
    }


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(_build_prompt(request.messages)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/chat")
async def chat(request: ChatRequest) -> dict[str, object]:
    parts: list[str] = []
    try:
        async for delta in llm.stream_chat(_build_prompt(request.messages)):
            parts.append(delta)
    except llm.LLMError as exc:
        logger.warning("LLM error: %s", exc)
        return {"ok": False, "error": str(exc), "model": settings.model}
    return {"ok": True, "reply": "".join(parts), "model": settings.model}


def run() -> None:
    uvicorn.run(
        "ai_powered_inventory_assistant.api:app",
        host=settings.host,
        port=settings.port,
        log_level="info",
    )


if __name__ == "__main__":
    run()
