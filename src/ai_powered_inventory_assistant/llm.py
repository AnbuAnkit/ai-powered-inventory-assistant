"""Streaming chat client for Google's Gemini API via LangChain."""

from __future__ import annotations

import logging
import os
import sqlite3
from collections.abc import AsyncIterator, Sequence

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai._common import GoogleGenerativeAIError

from .config import Settings, settings as default_settings
from .database_tools import create_database_tools

logger = logging.getLogger("inventory_assistant.llm")
MAX_TOOL_ROUNDS = 5


def _message_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part["text"]
            for part in content
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        )
    return ""


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
    """Yield reply text after the model has used any required database tools."""
    cfg = settings or default_settings
    if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
        raise LLMError(
            "Google API credentials are missing. Set GOOGLE_API_KEY in the "
            "backend environment or project .env file."
        )

    try:
        model = ChatGoogleGenerativeAI(
            model=cfg.model,
            # temperature=0,
            request_timeout=cfg.request_timeout,
            thinking_level="low",
        )
        tools = create_database_tools(cfg.database_path)
        tools_by_name = {item.name: item for item in tools}
        agent = model.bind_tools(tools)
        conversation = _to_langchain_messages(messages)
        for tool_round in range(MAX_TOOL_ROUNDS + 1):
            response: AIMessageChunk | None = None
            async for chunk in agent.astream(conversation):
                if not isinstance(chunk, AIMessageChunk):
                    raise LLMError("The model returned an unsupported response.")
                response = chunk if response is None else response + chunk
                text = _message_text(chunk.content)
                if text:
                    yield text
            if response is None:
                raise LLMError("The model returned an empty response.")
            if not response.tool_calls:
                return

            if tool_round == MAX_TOOL_ROUNDS:
                break
            conversation.append(
                AIMessage(content=response.content, tool_calls=response.tool_calls)
            )
            for call in response.tool_calls:
                tool_id = call.get("id")
                tool_name = call.get("name")
                if not tool_id or not tool_name:
                    raise LLMError("The model returned an invalid database tool call.")
                tool = tools_by_name.get(tool_name)
                if tool is None:
                    raise LLMError(f"The model requested an unknown tool: {tool_name}")
                try:
                    result = await tool.ainvoke(call.get("args", {}))
                except (sqlite3.Error, ValueError) as exc:
                    logger.warning("Database tool %s failed: %s", tool_name, exc)
                    result = f"Tool error: {exc}"
                conversation.append(ToolMessage(content=str(result), tool_call_id=tool_id))
        raise LLMError("The model exceeded the maximum number of database tool calls.")
    except GoogleGenerativeAIError as exc:
        raise LLMError(f"Google Gemini call failed: {exc}") from exc
