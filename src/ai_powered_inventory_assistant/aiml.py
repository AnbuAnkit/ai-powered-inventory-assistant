"""A small AIML response engine for common greetings."""

from __future__ import annotations

import re
from importlib.resources import files
from xml.etree import ElementTree

MODEL_NAME = "AIML"


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w*]+", " ", text.casefold())).strip()


def _pattern_regex(pattern: str) -> re.Pattern[str]:
    tokens = _normalize(pattern).split()
    expression = r"\s+".join(r".+" if token == "*" else re.escape(token) for token in tokens)
    return re.compile(f"^{expression}$")


def _load_categories() -> list[tuple[re.Pattern[str], str]]:
    source = files(__package__).joinpath("greetings.aiml")
    root = ElementTree.parse(source).getroot()
    categories: list[tuple[re.Pattern[str], str]] = []
    for category in root.findall("category"):
        pattern = category.findtext("pattern")
        template = category.find("template")
        if pattern is None or template is None:
            raise ValueError("AIML categories must include a pattern and template")
        categories.append((_pattern_regex(pattern), "".join(template.itertext()).strip()))
    return categories


_CATEGORIES = _load_categories()


def respond(message: str) -> str | None:
    """Return a local AIML response for a matching greeting, if one exists."""
    normalized = _normalize(message)
    for pattern, response in _CATEGORIES:
        if pattern.fullmatch(normalized):
            return response
    return None
