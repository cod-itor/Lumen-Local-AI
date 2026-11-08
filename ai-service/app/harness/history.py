"""History steps 4–6 (HARNESS.md §7.5); the backend already did steps 1–3."""

from __future__ import annotations

import re
from typing import Any

_CITATION = re.compile(r"\s?\[\d+(?:\s*,\s*\d+)*\]")
_EXACT = re.compile(r"^\s*\*\*Exact result:\*\*.*$", re.MULTILINE)
_SPACES = re.compile(r"[ \t]+")
_BLANKS = re.compile(r"\n{3,}")


def clean_assistant(text: str) -> str:
    text = _EXACT.sub("", _CITATION.sub("", text))
    return _BLANKS.sub("\n\n", _SPACES.sub(" ", text)).strip()


def cut(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    tail = 200 if max_chars > 400 else max_chars // 5
    return text[: max_chars - tail] + " … " + text[-tail:]


def prepare_history(history: list[dict[str, str]], pipeline: str, harness: dict[str, Any]) -> list[dict[str, str]]:
    """Clean, cut and cap; returns complete user/assistant pairs, oldest first."""
    b = harness["budgets"]
    out: list[dict[str, str]] = []
    for m in history:
        role = m.get("role")
        if role not in ("user", "assistant"):
            continue
        content = m.get("content") or ""
        if role == "assistant":
            content = clean_assistant(content)
        out.append({"role": role, "content": cut(content, b["historyMessageMaxChars"])})
    # keep only proper pairs (user then assistant)
    pairs: list[dict[str, str]] = []
    i = 0
    while i + 1 < len(out):
        if out[i]["role"] == "user" and out[i + 1]["role"] == "assistant":
            pairs += [out[i], out[i + 1]]
            i += 2
        else:
            i += 1
    cap = int(b["historyMaxMessages"].get(pipeline, 4))
    cap -= cap % 2
    return pairs[-cap:] if cap > 0 else []
