<<<<<<< HEAD
# AI Powered Inventory Assistant

A ChatGPT-style chat interface for an inventory assistant. The React UI runs on
web, iOS and Android from one codebase (Expo + React Native Web); a small
FastAPI backend streams replies from Google's Gemini API through LangChain.
Google credentials stay on the backend and never reach the client.

```
mobile/  (Expo app: web + iOS + Android)
   │  POST /api/chat/stream  (SSE tokens)
   ▼
src/ai_powered_inventory_assistant/  (FastAPI + LangChain)
   │  Gemini API request
   ▼
Google Gemini API
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
- A Google AI Studio API key and a model available through the Gemini API

## Run it

```bash
# 1. Terminal: configure GOOGLE_API_KEY in .env
cp .env.example .env

# 2. Terminal: start the API
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
npx expo start --go --lan
```

The web prototype has an **Open on phone** button in its header that displays
the Expo Go QR code. Keep the Expo development server running, then scan the
code with Expo Go. For local testing, open the web app at
`http://<computer-lan-ip>:8081` (not `localhost`) and connect the phone and
computer to the same Wi-Fi. Metro's host address also lets the phone app reach
the local backend on port 8000.

For tunneling, run `npx expo start --go --tunnel`; the phone also needs a
publicly reachable backend URL via `EXPO_PUBLIC_API_URL`. When building the web
prototype for Vercel, set `EXPO_PUBLIC_EXPO_GO_URL` to the active Expo Go URL
so the deployed QR points to the development server. See
`mobile/.env.example` for the backend URL setting.

### Deploy the web prototype to Vercel

1. Import this Git repository in Vercel and set the project **Root Directory**
   to `mobile`. The Vercel build settings in `mobile/vercel.json` export the
   Expo web app to `dist`.
2. Add these Vercel environment variables for the Production environment:
   - `EXPO_PUBLIC_EXPO_GO_URL`: the `exp://...` URL printed by
     `npx expo start --go --tunnel`.
   - `EXPO_PUBLIC_API_URL`: a public HTTPS URL for the FastAPI backend.
3. Deploy or redeploy after setting the variables. The QR URL is embedded at
   build time, so redeploy the web app if the Expo tunnel URL changes.

Vercel hosts only the static web frontend here. It does not host the FastAPI
backend or its SQLite database. For a live demo, keep the Expo tunnel and the
backend reachable for the duration of the presentation; never put
`GOOGLE_API_KEY` in a `EXPO_PUBLIC_*` variable.

For a separate Vercel backend project, use the repository root as its Root
Directory, leave the Build Command unset so Vercel uses its Python runtime,
and deploy the FastAPI entrypoint configured in `pyproject.toml`. The repository
pins Python 3.12 for Vercel; `pyproject.toml` still declares Python 3.11 as the
minimum supported version for local development. Do not set `uv run
inventory-api` as the Vercel Build Command; that command starts a local server
rather than configuring the serverless function.

## API

| Method | Path               | Purpose                                              |
| ------ | ------------------ | ---------------------------------------------------- |
| GET    | `/api/health`      | Backend status and configured model                  |
| GET    | `/api/datasets/sales` | Filtered, paginated sales records                    |
| GET    | `/api/datasets/sales/summary` | Totals and region/category breakdowns       |
| POST   | `/api/chat/stream` | SSE stream: `delta`, `done`, `error` events          |
| POST   | `/api/chat`        | Single JSON reply; fallback for clients without streaming fetch |

Both chat endpoints take `{"messages": [{"role": "user" | "assistant", "content": "..."}]}`
and require the last message to be from the user.

The API imports the `Sales_Data` sheet from the Excel workbook into
`datasets/sales.sqlite3` whenever it starts. The `sales` table is regenerated
from the workbook on startup. Query the data with optional `region`, `category`,
`product`, `salesperson`, `start_date`, and `end_date` filters. The records
endpoint also accepts `limit` (1-500, defaults to 50) and `offset`.

The chat agent can use backend tools to search and summarize sales data and to
list, add, update, or delete inventory items in the persistent `inventory_items`
table. Inventory rows are not overwritten when sales are reimported. The model
does not execute arbitrary SQL: sales tools are read-only, and inventory writes
are limited to validated fields (`product`, `stock_quantity`, `supplier`, and
`reorder_point`).
For profit-ranking questions, it aggregates profit by product from the `sales`
table. The workbook contains sales and profit, but no unit-price field.

```text
GET /api/datasets/sales?region=West&category=Electronics&limit=20
GET /api/datasets/sales/summary?start_date=2024-01-01&end_date=2024-12-31
```

## Configuration

See `.env.example` for all backend settings (`GOOGLE_API_KEY`, `GOOGLE_MODEL`,
`SYSTEM_PROMPT`, `DATASET_PATH`, `DATABASE_PATH`, CORS, history window, timeout).
Client-side overrides live in `mobile/.env.example`.

## Tests

```bash
uv run pytest          # API contract, streaming events, error paths
cd mobile && npm run typecheck
```

## Where to extend

- `src/ai_powered_inventory_assistant/llm.py` — LangChain Google model integration
- `mobile/src/hooks/useChat.ts` — conversation state, stop/retry
- `mobile/src/components/` — UI building blocks (all platform-neutral)
- `src/ai_powered_inventory_assistant/api.py` — endpoints and prompt assembly
