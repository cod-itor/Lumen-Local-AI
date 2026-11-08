"""Conservative token estimate (HARNESS.md §7.1); constants from rules/harness.yaml → tokenEstimate."""

from __future__ import annotations

import math
from typing import Any

_KHMER_RANGES = ((0x1780, 0x17FF), (0x19E0, 0x19FF))


def is_khmer(ch: str) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in _KHMER_RANGES)


def est_tokens(text: str, harness: dict[str, Any], token_factor: float = 1.0, messages: int = 1) -> int:
    te = harness["tokenEstimate"]
    ascii_chars = khmer_chars = other_chars = 0
    for ch in text:
        if ord(ch) < 128:
            ascii_chars += 1
        elif is_khmer(ch):
            khmer_chars += 1
        else:
            other_chars += 1
    raw = (
        ascii_chars / te["asciiCharsPerToken"]
        + khmer_chars * te["khmerTokensPerChar"]
        + other_chars * te["otherTokensPerChar"]
    ) * token_factor
    return math.ceil(raw) + te["perMessageOverhead"] * messages
