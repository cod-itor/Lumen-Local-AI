"""Markdown-safe translation (HARNESS.md §6.3) with a fake engine, and the language steps P6/F13."""

from __future__ import annotations

from app.models import translator


async def test_translate_markdown_keeps_structure(monkeypatch):
    seen: list[str] = []

    async def fake(sentences, src, tgt):
        seen.extend(sentences)
        return [f"«{s[:-1]}»{s[-1]}" if s.endswith(".") else f"«{s}»" for s in sentences]

    monkeypatch.setattr(translator, "translate_sentences", fake)
    text = "## Cells\n- The cell has a nucleus [1].\n- See `nucleus()` at https://x.org/a.\n\n```\ncode stays\n```"
    out = await translator.translate_markdown(text, "EN", "KM")
    lines = out.split("\n")
    assert lines[0] == "## «Cells»"
    assert lines[1] == "- «The cell has a nucleus» [1]."
    assert "`nucleus()`" in lines[2] and "https://x.org/a" in lines[2]
    assert "```\ncode stays\n```" in out
    assert all("[1]" not in s and "https://" not in s for s in seen)


async def test_lost_placeholder_keeps_source(monkeypatch):
    async def fake(sentences, src, tgt):
        return ["no placeholder here" for _ in sentences]

    monkeypatch.setattr(translator, "translate_sentences", fake)
    out = await translator.translate_markdown("Use `print()` here.", "EN", "KM")
    assert out == "Use `print()` here."


async def test_no_translator_returns_none(monkeypatch):
    async def none(sentences, src, tgt):
        return None

    monkeypatch.setattr(translator, "translate_sentences", none)
    assert await translator.translate_markdown("Hello.", "EN", "KM") is None
