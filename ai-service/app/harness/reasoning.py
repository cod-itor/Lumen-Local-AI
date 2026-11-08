"""Reasoning removal (HARNESS.md §8.1, F1) — batch and streaming."""

from __future__ import annotations

import re

_PAIRS = (("<think>", "</think>"), ("<|channel>thought", "<channel|>"))
_LABEL = re.compile(r"^\s*(Assistant|ANSWER|Answer)\s*:\s*")


def strip_reasoning(text: str) -> str:
    for start, end in _PAIRS:
        while True:
            i = text.find(start)
            if i == -1:
                break
            j = text.find(end, i + len(start))
            text = text[:i] if j == -1 else text[:i] + text[j + len(end) :]
    return _LABEL.sub("", text, count=1)


class StreamReasoningFilter:
    """Feeds raw chunks, returns only visible text (holds back a possible partial tag)."""

    def __init__(self) -> None:
        self.raw = ""
        self.emitted = 0

    def feed(self, chunk: str) -> str:
        self.raw += chunk
        visible = self._visible(final=False)
        new = visible[self.emitted :]
        self.emitted = len(visible)
        return new

    def finish(self) -> str:
        visible = self._visible(final=True)
        new = visible[self.emitted :]
        self.emitted = len(visible)
        return new

    def _visible(self, final: bool) -> str:
        text = self.raw
        out = []
        i = 0
        while i < len(text):
            hit = None
            for start, end in _PAIRS:
                if text.startswith(start, i):
                    hit = (start, end)
                    break
            if hit:
                j = text.find(hit[1], i + len(hit[0]))
                if j == -1:
                    break  # inside reasoning until the end (for now)
                i = j + len(hit[1])
                continue
            if not final and any(s.startswith(text[i:]) for s, _ in _PAIRS) and text[i] == "<":
                break  # possible partial opening tag at the end: wait for more
            out.append(text[i])
            i += 1
        return "".join(out)
