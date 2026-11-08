"""Sentence-packed chunks with overlap, never crossing pages (AI_SERVICE.md §13 step 4)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.harness.budget import est_tokens

_EN_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")


@dataclass
class Chunk:
    page: int | None
    ordinal: int
    start: int
    end: int
    text: str


def _tok(text: str, harness: dict[str, Any]) -> int:
    return est_tokens(text, harness, 1.0, messages=0)


def _sentences(text: str, khmer_ends: list[str]) -> list[tuple[int, int]]:
    """Sentence spans of a page: paragraphs (blank lines), then EN and KM sentence ends."""
    ends = "".join(re.escape(e) for e in khmer_ends)
    km_split = re.compile(rf"(?<=[{ends}])\s*")
    spans: list[tuple[int, int]] = []
    for para in re.finditer(r"[^\n](?:.|\n(?!\s*\n))*", text):
        p_start, p_text = para.start(), para.group(0)
        cuts = {0, len(p_text)}
        for m in _EN_SPLIT.finditer(p_text):
            cuts.add(m.end())
        for m in km_split.finditer(p_text):
            if 0 < m.end() < len(p_text):
                cuts.add(m.end())
        pts = sorted(cuts)
        for a, b in zip(pts, pts[1:], strict=False):
            seg = p_text[a:b]
            if seg.strip():
                lead = len(seg) - len(seg.lstrip())
                spans.append((p_start + a + lead, p_start + a + len(seg.rstrip())))
    return spans


def _split_long(text: str, span: tuple[int, int], target: int, harness: dict[str, Any]) -> list[tuple[int, int]]:
    """A sentence longer than the target is cut at word boundaries."""
    a, b = span
    s = text[a:b]
    if _tok(s, harness) <= target:
        return [span]
    bounds = [m.end() for m in re.finditer(r"\s+", s)]
    if not bounds:  # Khmer without spaces: cut between segmenter tokens
        try:
            import khmercut

            pos, bounds = 0, []
            for t in khmercut.tokenize(s):
                pos += len(t)
                bounds.append(pos)
        except Exception:  # noqa: BLE001
            bounds = list(range(200, len(s), 200))
    out, start, last = [], 0, 0
    for cut in [*bounds, len(s)]:
        if _tok(s[start:cut], harness) > target and last > start:
            out.append((a + start, a + last))
            start = last
        last = cut
    if start < len(s):
        out.append((a + start, a + len(s)))
    return [(x, y) for x, y in out if text[x:y].strip()]


def chunk_pages(pages: list[str], paginated: bool, harness: dict[str, Any]) -> list[Chunk]:
    cfg = harness["chunking"]
    target, overlap, minimum = cfg["targetTokens"], cfg["overlapTokens"], cfg["minChunkTokens"]
    chunks: list[Chunk] = []
    for n, text in enumerate(pages, start=1):
        page = n if paginated else None
        units: list[tuple[int, int]] = []
        for sp in _sentences(text, cfg.get("khmerSentenceEnds", ["។", "៕", "?", "!"])):
            units += _split_long(text, sp, target, harness)
        if not units:
            continue
        toks = [_tok(text[a:b], harness) for a, b in units]
        page_chunks: list[tuple[int, int]] = []
        i = 0
        while i < len(units):
            j, total = i, 0
            while j < len(units) and (j == i or total + toks[j] <= target):
                total += toks[j]
                j += 1
            page_chunks.append((i, j))
            if j >= len(units):
                break
            k, back = j, 0
            while k - 1 > i and back + toks[k - 1] <= overlap:
                k -= 1
                back += toks[k]
            i = max(k, i + 1)
        if len(page_chunks) > 1:
            last_i, last_j = page_chunks[-1]
            if sum(toks[last_i:last_j]) < minimum:
                prev_i, _ = page_chunks[-2]
                page_chunks[-2:] = [(prev_i, last_j)]
        for i, j in page_chunks:
            a, b = units[i][0], units[j - 1][1]
            chunks.append(Chunk(page=page, ordinal=len(chunks), start=a, end=b, text=text[a:b]))
    return chunks
