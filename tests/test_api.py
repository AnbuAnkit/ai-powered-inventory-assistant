import json
from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from ai_powered_inventory_assistant import api, llm


@pytest.fixture()
def client() -> TestClient:
    return TestClient(api.app)


def _event_payloads(body: str) -> list[dict]:
    events = []
    for block in body.split("\n\n"):
        for line in block.splitlines():
            if line.startswith("data:"):
                events.append(json.loads(line[len("data:") :].strip()))
    return events


async def _fake_stream(deltas: list[str]) -> AsyncIterator[str]:
    for delta in deltas:
        yield delta


def test_health_reports_ollama_state(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_models(*args, **kwargs) -> list[str]:
        return ["llama3.2:latest"]

    monkeypatch.setattr(llm, "list_models", fake_models)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "model": api.settings.model,
        "ollama": {
            "base_url": api.settings.ollama_base_url,
            "reachable": True,
            "models": ["llama3.2:latest"],
        },
    }


def test_health_survives_unreachable_ollama(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def boom(*args, **kwargs) -> list[str]:
        raise OSError("connection refused")

    monkeypatch.setattr(llm, "list_models", boom)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["ollama"]["reachable"] is False


def test_stream_returns_deltas_then_done(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_stream(*args, **kwargs) -> AsyncIterator[str]:
        async for delta in _fake_stream(["Low ", "stock: ", "3 items."]):
            yield delta

    monkeypatch.setattr(llm, "stream_chat", fake_stream)

    response = client.post(
        "/api/chat/stream",
        json={"messages": [{"role": "user", "content": "what is low on stock?"}]},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert _event_payloads(response.text) == [
        {"type": "delta", "text": "Low "},
        {"type": "delta", "text": "stock: "},
        {"type": "delta", "text": "3 items."},
        {"type": "done", "text": "Low stock: 3 items.", "model": api.settings.model},
    ]


def test_stream_sends_error_event(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_stream(*args, **kwargs) -> AsyncIterator[str]:
        yield "partial"
        raise llm.LLMError("Model 'llama3.2' is not available on Ollama.")

    monkeypatch.setattr(llm, "stream_chat", failing_stream)

    response = client.post(
        "/api/chat/stream",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )

    events = _event_payloads(response.text)
    assert events[0] == {"type": "delta", "text": "partial"}
    assert events[1] == {
        "type": "error",
        "message": "Model 'llama3.2' is not available on Ollama.",
    }
    assert not any(event["type"] == "done" for event in events)


def test_prompt_includes_system_message_and_history_trimming(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: list[list[dict[str, str]]] = []

    async def capture(prompt, *args, **kwargs) -> AsyncIterator[str]:
        captured.append(prompt)
        yield "ok"

    monkeypatch.setattr(llm, "stream_chat", capture)

    messages = [
        {"role": "user" if index % 2 == 0 else "assistant", "content": f"m{index}"}
        for index in range(40)
    ]
    messages.append({"role": "user", "content": "latest"})

    client.post("/api/chat/stream", json={"messages": messages})

    prompt = captured[0]
    assert prompt[0] == {"role": "system", "content": api.settings.system_prompt}
    assert prompt[-1] == {"role": "user", "content": "latest"}
    assert len(prompt) == api.settings.max_history_messages + 1


def test_buffered_chat_returns_full_reply(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_stream(*args, **kwargs) -> AsyncIterator[str]:
        async for delta in _fake_stream(["hello", " there"]):
            yield delta

    monkeypatch.setattr(llm, "stream_chat", fake_stream)

    response = client.post(
        "/api/chat", json={"messages": [{"role": "user", "content": "hi"}]}
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "reply": "hello there",
        "model": api.settings.model,
    }


def test_rejects_conversation_not_ending_with_user(client: TestClient) -> None:
    response = client.post(
        "/api/chat/stream",
        json={"messages": [{"role": "assistant", "content": "I am the assistant"}]},
    )

    assert response.status_code == 422


def test_rejects_empty_messages(client: TestClient) -> None:
    response = client.post("/api/chat", json={"messages": []})

    assert response.status_code == 422
