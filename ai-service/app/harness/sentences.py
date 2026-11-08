"""Sentence splitting, words and content words (AI_SERVICE.md §8.1, HARNESS.md §10.2 step 3)."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

SENT_END = re.compile(r"(?<=[.!?។៕])\s+")
BULLET = re.compile(r"^\s*(?:[-*+•]|\d+[.)])\s+")
CITATION = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")
CITE_ONLY = re.compile(r"^\s*(?:\[\d+(?:\s*,\s*\d+)*\]\s*)+[.!?។]?\s*$")
EN_WORD = re.compile(r"[A-Za-z][A-Za-z'-]*|\d+(?:[.,:]\d+)*")
KHMER_RUN = re.compile(r"[ក-៿᧠-᧿]+")
NUMBER = re.compile(r"\d+(?:[.,:]\d+)*")


@lru_cache(maxsize=1)
def stopwords() -> frozenset[str]:
    return frozenset((Path(__file__).with_name("stopwords_en.txt")).read_text("utf-8").split())


def split_spans(text: str) -> list[tuple[int, int]]:
    """Sentence spans (code-point offsets). Lines and bullet items are sentences; fenced code is skipped;
    a fragment that is only citations is merged into the previous sentence."""
    spans: list[tuple[int, int]] = []
    pos = 0
    in_code = False
    for line in text.split("\n"):
        start_line = pos
        pos += len(line) + 1
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line.strip():
            continue
        cursor = 0
        pieces: list[tuple[int, int]] = []
        for m in SENT_END.finditer(line):
            pieces.append((cursor, m.start()))
            cursor = m.end()
        pieces.append((cursor, len(line)))
        for a, b in pieces:
            seg = line[a:b]
            if not seg.strip():
                continue
            lead = len(seg) - len(seg.lstrip())
            a2, b2 = start_line + a + lead, start_line + a + len(seg.rstrip())
            if spans and CITE_ONLY.match(seg) and spans[-1][1] <= a2:
                spans[-1] = (spans[-1][0], b2)
            else:
                spans.append((a2, b2))
    return spans


def plain(sentence: str) -> str:
    """Sentence without the bullet marker and citation markers."""
    return CITATION.sub("", BULLET.sub("", sentence)).strip()


def words(text: str) -> list[str]:
    out = EN_WORD.findall(text)
    runs = KHMER_RUN.findall(text)
    if runs:
        try:
            import khmercut

            for r in runs:
                out += [t for t in khmercut.tokenize(r) if t.strip()]
        except Exception:  # noqa: BLE001 — segmenter missing: whole runs count as words
            out += runs
    return out


def content_words(text: str) -> set[str]:
    sw = stopwords()
    out: set[str] = set()
    for w in words(text):
        lw = w.lower()
        if lw[0].isdigit():
            out.add(normalize_number(lw))
        elif KHMER_RUN.fullmatch(w) or (len(lw) >= 3 and lw not in sw):
            out.add(lw)
    return out


def normalize_number(n: str) -> str:
    if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", n):
        n = n.replace(",", "")
    return n.rstrip(".,")


def numbers(text: str) -> set[str]:
    return {normalize_number(n) for n in NUMBER.findall(text)}


def utf16(text: str, i: int) -> int:
    return len(text[:i].encode("utf-16-le")) // 2
