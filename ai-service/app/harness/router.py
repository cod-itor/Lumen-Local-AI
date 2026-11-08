"""Router: pipeline, intents, notes and suggestions (HARNESS.md §5). Pure code, never calls a model."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.rules.models import Rules

SUGGESTION_LABELS = {
    "TURN_ON_WEB_SEARCH": "Turn on web search",
    "VERIFY_WITH_WEB_SEARCH": "Check with web search",
    "OPEN_IMAGE_TAB": "Open the Image tab",
    "START_LEARNING_PATH": "Start a learning path",
    "UPLOAD_DOCUMENT": "Upload a document",
    "ASK_MY_DOCUMENTS": "Ask my documents",
    "SWITCH_TO_HOST_MODEL": "Try the host model",
}

_YEAR = re.compile(r"\b(19\d{2}|20\d{2}|21\d{2})\b")
_LEARN_PREFIX = re.compile(
    r"^\s*(please\s+)?(teach me( about)?|i want to learn( about)?|i'd like to learn( about)?|"
    r"help me learn( about)?)\s*",
    re.IGNORECASE,
)


def suggestion(kind: str, payload: dict[str, str] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"type": kind, "label": SUGGESTION_LABELS[kind]}
    if payload:
        out["payload"] = payload
    return out


@dataclass
class Routing:
    pipeline: str | None
    intents: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    suggestions: list[dict[str, Any]] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {"intents": self.intents, "notes": self.notes, "suggestions": self.suggestions}


def _matches(rules: Rules, intent: str, texts: list[str]) -> bool:
    return any(p.search(t) for p in rules.patterns.get(f"router.{intent}", []) for t in texts if t)


def pick_pipeline(task: str, tab: str | None, web_search: bool, web_enabled: bool) -> str | None:
    if task != "MESSAGE":
        return None
    if tab == "DOCS":
        return "RAG"
    if web_search and web_enabled:
        return "WEB"
    return "CHAT"


def route(
    rules: Rules,
    *,
    task: str,
    tab: str | None,
    web_search: bool,
    web_enabled: bool,
    original: str,
    model_input: str,
    current_year: int,
    math_detected: bool = False,
) -> Routing:
    r = Routing(pipeline=pick_pipeline(task, tab, web_search, web_enabled))
    if task != "MESSAGE":
        return r
    cfg = rules.harness["router"]
    texts = [original, model_input]
    found: list[str] = []
    if math_detected:
        found.append("MATH")
    for intent in ("DATETIME", "CURRENT_INFO", "IMAGE_REQUEST", "LEARNING_REQUEST", "DOC_REFERENCE", "GREETING"):
        if _matches(rules, intent, texts):
            found.append(intent)
    if "CURRENT_INFO" not in found and any(
        int(y) >= current_year - cfg["recentYearWindow"] for t in texts for y in _YEAR.findall(t or "")
    ):
        found.append("CURRENT_INFO")
    if "DATETIME" in found and "CURRENT_INFO" in found:
        found.remove("CURRENT_INFO")  # DATETIME suppresses CURRENT_INFO
    if "GREETING" in found and len(original.split()) > 6:
        found.remove("GREETING")
    if "DOC_REFERENCE" in found and tab != "CHAT":
        found.remove("DOC_REFERENCE")
    r.intents = found

    notes: dict[str, str] = {}
    if "CURRENT_INFO" in found and r.pipeline == "CHAT":
        notes["current_info"] = cfg["notes"]["current_info"]
        if web_enabled:
            r.suggestions.append(suggestion("TURN_ON_WEB_SEARCH"))
    if "IMAGE_REQUEST" in found:
        notes["image_request"] = cfg["notes"]["image_request"]
        r.suggestions.append(suggestion("OPEN_IMAGE_TAB", {"request": original[:300]}))
    if "LEARNING_REQUEST" in found:
        goal = _LEARN_PREFIX.sub("", original).strip(" .?!") or original
        r.suggestions.append(suggestion("START_LEARNING_PATH", {"goal": goal[:200]}))
    if "DOC_REFERENCE" in found:
        notes["doc_reference"] = cfg["notes"]["doc_reference"]
        r.suggestions.append(suggestion("ASK_MY_DOCUMENTS"))
    if "GREETING" not in found:
        r.notes = [notes[k] for k in cfg["notePriority"] if k in notes][: cfg["notesMax"]]
    return r
