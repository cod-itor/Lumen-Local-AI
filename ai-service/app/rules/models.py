"""Typed views of the files in rules/ (RULES.md §1–2)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

Task = Literal[
    "MESSAGE",
    "TITLE",
    "IMAGE_CLARIFY",
    "IMAGE_PROMPT",
    "LEARN_QUESTION",
    "LEARN_PLAN",
    "LEARN_STEP",
    "QUIZ",
    "INTERNAL",
]
TASKS: set[str] = {
    "MESSAGE",
    "TITLE",
    "IMAGE_CLARIFY",
    "IMAGE_PROMPT",
    "LEARN_QUESTION",
    "LEARN_PLAN",
    "LEARN_STEP",
    "QUIZ",
    "INTERNAL",
}
PIPELINES: set[str | None] = {"CHAT", "RAG", "WEB", None}
OUTPUTS = {"text", "json"}
REFERENCE_DATA = {"none", "documents", "web", "lesson"}
EVAL_CATEGORIES = {
    "SAFETY",
    "INJECTION",
    "RAG_FAITHFULNESS",
    "RAG_ABSTAIN",
    "KNOWLEDGE_HUMILITY",
    "TOOL_USE",
    "INSTRUCTION",
    "JSON",
    "KHMER",
}

#: Variables every template may use (RULES.md §3).
GLOBAL_VARIABLES = {
    "APP_NAME",
    "TODAY",
    "WEEKDAY",
    "TIMEZONE",
    "ANSWER_LANGUAGE",
    "MAX_WORDS",
    "COUNT",
    "SOURCE_LANGUAGE",
    "TARGET_LANGUAGE",
    "EMERGENCY_LINE",
}


@dataclass(frozen=True)
class SystemPrompt:
    version: int
    variables: tuple[str, ...]
    body: str


@dataclass(frozen=True)
class Mode:
    id: str
    version: int
    task: str
    pipeline: str | None
    output: str
    schema: str | None
    temperature: float
    max_output_tokens: int
    max_words: int
    reference_data: str
    instructions: str
    reminder: str
    example: str | None = None
    abstain_text: str | None = None
    stop: tuple[str, ...] = ()
    variables: tuple[str, ...] = ()

    @property
    def tag(self) -> str:
        """Logged with each turn, e.g. "rag@1"."""
        return f"{self.id}@{self.version}"


@dataclass(frozen=True)
class EvalCase:
    id: str
    category: str
    quick: bool
    task: str
    raw: dict[str, Any]


@dataclass(frozen=True)
class EvalSuite:
    id: str
    version: int
    cases: tuple[EvalCase, ...]

    @property
    def quick_count(self) -> int:
        return sum(1 for c in self.cases if c.quick)

    @property
    def categories(self) -> list[str]:
        return sorted({c.category for c in self.cases})


@dataclass(frozen=True)
class Rules:
    """Immutable snapshot of rules/. Reload swaps the whole object (AI_SERVICE.md §5)."""

    version: str
    loaded_at: datetime
    system: SystemPrompt
    modes: dict[str, Mode]
    schemas: dict[str, dict[str, Any]]
    harness: dict[str, Any]
    guardrails: dict[str, Any]
    models: dict[str, Any]
    suites: dict[str, EvalSuite]
    fixtures: dict[str, str]
    patterns: dict[str, list[re.Pattern[str]]] = field(default_factory=dict)

    def mode_for(self, task: str, pipeline: str | None = None) -> Mode:
        for m in self.modes.values():
            if m.task == task and (task != "MESSAGE" or m.pipeline == pipeline):
                return m
        raise KeyError(f"No mode for task={task} pipeline={pipeline}")
