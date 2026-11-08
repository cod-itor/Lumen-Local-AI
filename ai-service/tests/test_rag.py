"""Chunking offsets, citation repair and grounding levels (AI_SERVICE.md §14, HARNESS.md §10.2)."""

from __future__ import annotations

import pytest

from app.harness import grounding as gv
from app.rag.chunking import chunk_pages
from app.rag.parse import clean
from app.state import rules

HANDBOOK = (
    "Students may borrow up to 3 books at a time. Books must be returned within 14 days. "
    "The late fee is 500 riel per book for each day after the due date.\n\n"
    "The library opens at 7:30 and closes at 17:00 on weekdays. It is closed on Sundays."
)


@pytest.fixture(autouse=True)
def _no_embeddings(monkeypatch):
    async def fake(texts):
        return [[0.0] * 768 for _ in texts]

    monkeypatch.setattr(gv, "embed", fake)


def test_chunk_offsets_match_page_text():
    pages = clean([HANDBOOK * 6, "Second page. " * 80])
    chunks = chunk_pages(pages, True, rules().harness)
    assert chunks and {c.page for c in chunks} == {1, 2}
    for c in chunks:
        assert pages[c.page - 1][c.start : c.end] == c.text
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))


def test_clean_removes_repeated_headers():
    pages = [f"Lumen Handbook\nPage {i}\nBody text number {i} is here." for i in range(1, 6)]
    out = clean(pages)
    assert all("Lumen Handbook" not in p and "Page" not in p for p in out)


SOURCES = [
    {"n": 1, "chunkId": "a", "text": HANDBOOK},
    {"n": 2, "chunkId": "b", "text": "Chlorophyll absorbs red light."},
]


async def _verify(text):
    return await gv.verify(text, SOURCES, {}, rules().harness["grounding"], "I couldn't find this in your documents.")


async def test_grounded_answer_with_citations():
    out, rep = await _verify(
        "Students may borrow up to 3 books at a time [1]. Books must be returned within 14 days [1]."
    )
    assert rep["level"] == "GROUNDED" and rep["supportedRatio"] == 1.0
    assert out.count("[1]") == 2


async def test_invalid_citation_removed_and_auto_cite():
    out, rep = await _verify("The late fee is 500 riel per book for each day after the due date [7].")
    assert rep["removedCitations"] == 1
    assert "[1]" in out and rep["sentences"][0]["supported"]


async def test_wrong_number_is_flagged():
    out, rep = await _verify("Students may borrow up to 5 books at a time [1].")
    s = rep["sentences"][0]
    assert not s["supported"] and s["issue"] == "NUMBER_NOT_IN_SOURCE"
    assert rep["level"] != "GROUNDED"


async def test_unsupported_sentence_is_ungrounded():
    _, rep = await _verify("The cafeteria serves free pizza every Friday afternoon for everyone.")
    assert rep["level"] == "UNGROUNDED"


async def test_offsets_are_utf16():
    text = "😀 Students may borrow up to 3 books at a time [1]."
    _, rep = await _verify(text)
    gv.set_offsets(text, rep)
    s = rep["sentences"][0]
    assert s["start"] == 0 and s["end"] == len(text.encode("utf-16-le")) // 2


def test_abstain_detection():
    assert gv.is_abstain("I couldn't find this in your documents.", "I couldn't find this in your documents.", [])
    assert not gv.is_abstain("Students may borrow 3 books [1].", "I couldn't find this in your documents.", [])
