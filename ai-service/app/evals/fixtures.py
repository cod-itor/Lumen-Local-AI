"""In-memory fixture corpus for Model Test RAG cases (HARNESS.md §12.2, AI_SERVICE.md §5).

Every file of rules/evals/fixtures/ is chunked like an uploaded document and embedded once (on first use or warm-up).
Chunk ids look like `fx:<file>:<ordinal>` so finalize can find their embeddings without the database.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from app.models.embeddings import doc_text, dot, embed, query_text
from app.rag.retrieval import Hit
from app.state import rules

log = logging.getLogger(__name__)


@dataclass
class _Corpus:
    version: str
    hits: dict[str, list[Hit]]
    vectors: dict[str, list[float]]


_corpus: _Corpus | None = None
_lock = asyncio.Lock()


async def corpus() -> _Corpus:
    global _corpus
    r = rules()
    if _corpus is not None and _corpus.version == r.version:
        return _corpus
    async with _lock:
        if _corpus is not None and _corpus.version == r.version:
            return _corpus
        from app.guard.engine import untrusted_score
        from app.harness.language import detect_language
        from app.rag.chunking import chunk_pages

        threshold = float(r.guardrails["classifiers"]["injection"]["threshold"])
        hits: dict[str, list[Hit]] = {}
        vectors: dict[str, list[float]] = {}
        for name, text in r.fixtures.items():
            chunks = chunk_pages([text], False, r.harness)
            vecs = await embed([doc_text(name, c.text) for c in chunks])
            hits[name] = []
            for c, v in zip(chunks, vecs, strict=True):
                cid = f"fx:{name}:{c.ordinal}"
                vectors[cid] = v
                hits[name].append(
                    Hit(
                        id=cid,
                        document_id=f"fx:{name}",
                        page=None,
                        ordinal=c.ordinal,
                        start=c.start,
                        end=c.end,
                        text=c.text,
                        text_en=None,
                        language=detect_language(c.text, r.harness),
                        injection_suspected=untrusted_score(r, c.text) >= threshold,
                    )
                )
        _corpus = _Corpus(r.version, hits, vectors)
        log.info("eval fixture corpus ready: %d files, %d chunks", len(hits), len(vectors))
        return _corpus


async def top_chunks(files: list[str], queries: list[str], k: int = 3) -> list[Hit]:
    """Top k fixture chunks by best cosine over the queries (no relevance gate)."""
    c = await corpus()
    qv = await embed([query_text(q) for q in queries])
    scored: list[Hit] = []
    for f in files:
        for h in c.hits.get(f, []):
            sim = max(dot(v, c.vectors[h.id]) for v in qv)
            scored.append(Hit(**{**h.__dict__, "sim": sim, "lists": set()}))
    scored.sort(key=lambda h: h.sim, reverse=True)
    return scored[:k]


async def embeddings(ids: list[str]) -> dict[str, list[float]]:
    c = await corpus()
    return {i: c.vectors[i] for i in ids if i in c.vectors}


async def warm_up() -> None:
    try:
        await corpus()
    except Exception as e:  # noqa: BLE001 — Ollama may still be starting; the first eval case retries
        log.warning("eval fixture corpus not ready yet: %s", e)
