"""Loop detector (HARNESS.md §8.4) and repeated-tail cleanup (F3)."""

from __future__ import annotations

from typing import Any


def _tail_loop(window: str, cfg: dict[str, Any]) -> int | None:
    """Return the repeat length L if the tail repeats ≥ maxRepeats times, else None."""
    for length in range(cfg["minRepeatLen"], cfg["maxRepeatLen"] + 1, cfg["repeatLenStep"]):
        if len(window) < length * cfg["maxRepeats"]:
            break
        tail = window[-length:]
        if tail.strip() and window.count(tail) >= cfg["maxRepeats"]:
            return length
    return None


def _same_line_loop(text: str, cfg: dict[str, Any]) -> bool:
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    run, prev = 0, None
    for ln in lines:
        if len(ln) < cfg["sameLineMinChars"]:
            run, prev = 0, None
            continue
        run = run + 1 if ln == prev else 1
        prev = ln
        if run >= cfg["sameLineRepeats"]:
            return True
    return False


def detect_loop(text: str, cfg: dict[str, Any]) -> bool:
    window = text[-cfg["windowChars"] :]
    return _tail_loop(window, cfg) is not None or _same_line_loop(window, cfg)


class LoopWatcher:
    """Streaming wrapper: checks every `checkEveryChars` new characters."""

    def __init__(self, cfg: dict[str, Any]) -> None:
        self.cfg = cfg
        self._last = 0

    def feed(self, text: str) -> bool:
        if len(text) - self._last < self.cfg["checkEveryChars"]:
            return False
        self._last = len(text)
        return detect_loop(text, self.cfg)


def cut_loop(text: str, cfg: dict[str, Any]) -> str:
    """Remove the repeated tail, keeping its first occurrence."""
    window_start = max(0, len(text) - cfg["windowChars"])
    window = text[window_start:]
    length = _tail_loop(window, cfg)
    if length is not None:
        unit = window[-length:]
        first = text.find(unit)
        if first != -1:
            # keep everything up to the end of the first repetition
            return text[: first + length].rstrip()
    lines = text.split("\n")
    out: list[str] = []
    for ln in lines:
        s = ln.strip()
        if out and s and len(s) >= cfg["sameLineMinChars"] and s == out[-1].strip():
            continue
        out.append(ln)
    return "\n".join(out).rstrip()
