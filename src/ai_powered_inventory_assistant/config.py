"""Runtime configuration for the chat API.

Every setting can be overridden with an environment variable (or a `.env`
file at the project root). Defaults target a local Ollama install.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful inventory assistant. Answer questions about stock "
    "levels, suppliers, reorder points and sales trends clearly and concisely. "
    "Use short paragraphs and bullet points when listing items. If you do not "
    "know something, say so instead of inventing numbers."
)


def _csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("API_HOST", "0.0.0.0")
    port: int = int(os.getenv("API_PORT", "8000"))

    ollama_base_url: str = os.getenv(
        "OLLAMA_BASE_URL", "http://localhost:11434"
    ).rstrip("/")
    model: str = os.getenv("OLLAMA_MODEL", "llama3.2")
    system_prompt: str = os.getenv("SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT)
    dataset_path: Path = Path(
        os.getenv(
            "DATASET_PATH",
            str(PROJECT_ROOT / "datasets" / "excel_sales_dataset_600_rows.xlsx"),
        )
    )
    database_path: Path = Path(
        os.getenv("DATABASE_PATH", str(PROJECT_ROOT / "datasets" / "sales.sqlite3"))
    )

    # How much conversation history to forward to the model.
    max_history_messages: int = int(os.getenv("MAX_HISTORY_MESSAGES", "24"))
    # Seconds to wait for the model before giving up on a response.
    request_timeout: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "180"))

    # Expo web runs on :8081, native dev clients send no Origin header.
    cors_origins: list[str] = field(
        default_factory=lambda: _csv(
            "CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081,*"
        )
    )


settings = Settings()
