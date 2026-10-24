# AI Powered Inventory Assistant

A ChatGPT-style chat interface for an inventory assistant. The React UI runs on
web, iOS and Android from one codebase (Expo + React Native Web); a small
FastAPI backend streams replies from a local LLM through Ollama so no API key or
model logic ever reaches the client.

```
mobile/  (Expo app: web + iOS + Android)
   │  POST /api/chat/stream  (SSE tokens)
   ▼
src/ai_powered_inventory_assistant/  (FastAPI)
   │  POST /api/chat  (NDJSON stream)
   ▼
Ollama on http://localhost:11434
```

## Features

- Token-by-token streaming replies, with a stop button and retry
- Responsive ChatGPT-like layout (centred column on desktop, full width on phones)
- Safe-area + keyboard handling, dark mode, web `Enter` to send / `Shift+Enter` for new lines
- Preset prompts on the empty screen and a live backend/model status badge
- Server-side history trimming and a configurable system prompt

## Prerequisites

- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- [Ollama](https://ollama.com/download) with a model pulled: `ollama pull llama3.2`

## Run it

```bash
# 1. Terminal: start the model server
ollama serve

# 2. Terminal: start the API (installs Python deps on first run)
cp .env.example .env      # optional, defaults work out of the box
uv sync
uv run inventory-api      # http://localhost:8000  (docs at /docs)

# 3. Terminal: start the app
cd mobile
npm install               # first time only
npm run web               # http://localhost:8081
```

### On a phone

```bash
cd mobile
npm start        # scan the QR code with Expo Go, or press i / a for simulators
```

The client resolves the API automatically: `localhost` on web and the iOS
simulator, Metro's LAN IP on a real device, and `10.0.2.2` on the Android
emulator (which maps to your machine). Your phone must be on the same Wi-Fi.
For a deployed backend set `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`).

## API

| Method | Path               | Purpose                                              |
| ------ | ------------------ | ---------------------------------------------------- |
| GET    | `/api/health`      | Backend status, model name, Ollama reachability      |
| POST   | `/api/chat/stream` | SSE stream: `delta`, `done`, `error` events          |
| POST   | `/api/chat`        | Single JSON reply; fallback for clients without streaming fetch |

Both chat endpoints take `{"messages": [{"role": "user" | "assistant", "content": "..."}]}`
and require the last message to be from the user.

## Configuration

See `.env.example` for all backend settings (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`,
`SYSTEM_PROMPT`, CORS, history window, timeout). Client-side overrides live in
`mobile/.env.example`.

## Tests

```bash
uv run pytest          # API contract, streaming events, error paths
cd mobile && npm run typecheck
```

## Where to extend

- `mobile/src/api/chat.ts` — transport (swap Ollama for another provider's API here)
- `mobile/src/hooks/useChat.ts` — conversation state, stop/retry
- `mobile/src/components/` — UI building blocks (all platform-neutral)
- `src/ai_powered_inventory_assistant/api.py` — endpoints and prompt assembly
