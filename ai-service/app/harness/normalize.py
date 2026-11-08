"""Input/output text normalization (HARNESS.md §4.1)."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from app.harness.budget import is_khmer

_ZERO_WIDTH = {"​", "‌", "‍", "⁠", "﻿"}
_BLANKS = re.compile(r"\n{3,}")


def _strip_controls(text: str) -> str:
    out: list[str] = []
    n = len(text)
    for i, ch in enumerate(text):
        if ch in ("\n", "\t"):
            out.append(ch)
            continue
        if ch in _ZERO_WIDTH:
            # U+200B is an invisible word separator inside Khmer text: keep it there.
            if ch == "​" and 0 < i < n - 1 and is_khmer(text[i - 1]) and is_khmer(text[i + 1]):
                out.append(ch)
            continue
        if unicodedata.category(ch) in ("Cc", "Cf") and ch != "្":
            continue
        out.append(ch)
    return "".join(out)


def neutralize_tokens(text: str, tokens: list[str]) -> str:
    """Make chat-template control tokens and our delimiters inert (GUARDRAILS.md §6.2)."""
    for tok in tokens:
        if not tok or tok not in text:
            continue
        idx = min((i for i in (tok.find("<"), tok.find("[")) if i != -1), default=-1)
        if idx == -1:
            continue
        look_alike = "＜" if tok[idx] == "<" else "［"
        text = text.replace(tok, tok[:idx] + look_alike + tok[idx + 1 :])
    return text


def control_tokens(guardrails: dict[str, Any]) -> list[str]:
    return list((((guardrails.get("injection") or {}).get("untrustedText") or {}).get("neutralizeTokens")) or [])


def normalize(text: str, guardrails: dict[str, Any] | None = None) -> str:
    text = unicodedata.normalize("NFC", text or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _strip_controls(text)
    text = _BLANKS.sub("\n\n", text).strip()
    if guardrails is not None:
        text = neutralize_tokens(text, control_tokens(guardrails))
    return text
