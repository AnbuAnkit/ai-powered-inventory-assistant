"""HTTP API for the chat UI.

POST /api/chat/stream  -> text/event-stream of JSON events:
                          {"type": "delta", "text": "..."}
                          {"type": "done",  "text": "<full reply>", "model": "..."}
                          {"type": "error", "message": "..."}
POST /api/chat         -> single JSON reply (fallback for clients without
                          streaming fetch support, e.g. React Native's fetch)
GET  /api/health       -> backend status and configured model
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from . import dataset
from . import llm
from .config import settings

logger = logging.getLogger("inventory_assistant.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    count = dataset.initialize_database(settings.database_path, settings.dataset_path)
    logger.info("Imported %d sales rows into %s", count, settings.database_path)
    yield


app = FastAPI(
    title="AI Powered Inventory Assistant API", version="0.1.0", lifespan=lifespan
)

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
    """Report backend availability for the UI connection badge."""
    return {
        "status": "ok",
        "model": settings.model,
    }


def _sales_filters(
    region: str | None,
    category: str | None,
    product: str | None,
    salesperson: str | None,
    start_date: date | None,
    end_date: date | None,
) -> dict[str, object]:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=422, detail="start_date must not be after end_date"
        )
    return {
        "region": region,
        "category": category,
        "product": product,
        "salesperson": salesperson,
        "start_date": start_date,
        "end_date": end_date,
    }


@app.get("/api/datasets/sales")
def sales_records(
    region: str | None = Query(default=None, min_length=1, max_length=100),
    category: str | None = Query(default=None, min_length=1, max_length=100),
    product: str | None = Query(default=None, min_length=1, max_length=100),
    salesperson: str | None = Query(default=None, min_length=1, max_length=100),
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, object]:
    filters = _sales_filters(
        region, category, product, salesperson, start_date, end_date
    )
    return dataset.query_sales(
        settings.database_path, **filters, limit=limit, offset=offset
    )


@app.get("/api/datasets/sales/summary")
def sales_summary(
    region: str | None = Query(default=None, min_length=1, max_length=100),
    category: str | None = Query(default=None, min_length=1, max_length=100),
    product: str | None = Query(default=None, min_length=1, max_length=100),
    salesperson: str | None = Query(default=None, min_length=1, max_length=100),
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, object]:
    filters = _sales_filters(
        region, category, product, salesperson, start_date, end_date
    )
    return dataset.summarize_sales(settings.database_path, **filters)


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
