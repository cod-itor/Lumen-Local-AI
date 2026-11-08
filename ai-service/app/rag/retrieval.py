"""Hybrid retrieval for the Documents tab (HARNESS.md §7.3, AI_SERVICE.md §7.3)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from pgvector import Vector

from app import db
from app.models.embeddings import embed, query_text

_VECTOR_SQL = """
WITH cand AS MATERIALIZED (
  SELECT id, document_id, page, ordinal, start_char, end_char, text, text_en, language,
         injection_suspected, embedding
  FROM chunks
  WHERE source = 'DOC' AND user_id = %(user_id)s AND document_id = ANY(%(doc_ids)s)
)
SELECT id, document_id, page, ordinal, start_char, end_char, text, text_en, language,
       injection_suspected, 1 - (embedding <=> %(q)s) AS sim
FROM cand
ORDER BY embedding <=> %(q)s
LIMIT %(k)s
"""

_LEXICAL_SQL = """
SELECT c.id, ts_rank_cd(c.tsv, q) AS rank
FROM chunks c, websearch_to_tsquery('english', %(text)s) q
WHERE c.source = 'DOC' AND c.user_id = %(user_id)s AND c.document_id = ANY(%(doc_ids)s) AND c.tsv @@ q
ORDER BY rank DESC
LIMIT %(k)s
"""

_OPENING_SQL = """
SELECT id, document_id, page, ordinal, start_char, end_char, text, text_en, language, injection_suspected, n
FROM (
  SELECT c.*, row_number() OVER (PARTITION BY document_id ORDER BY ordinal) AS rn, count(*) OVER () AS n
  FROM chunks c
  WHERE source = 'DOC' AND user_id = %(user_id)s AND document_id = ANY(%(doc_ids)s)
) x
WHERE rn <= %(per_doc)s
ORDER BY array_position(%(doc_ids)s, document_id), ordinal
"""


@dataclass
class Hit:
    id: str
    document_id: str
    page: int | None
    ordinal: int
    start: int | None
    end: int | None
    text: str
    text_en: str | None
    language: str | None
    injection_suspected: bool
    sim: float = 0.0
    lex_rank: int | None = None
    score: float = 0.0
    lists: set[str] = field(default_factory=set)


@dataclass
class Retrieval:
    hits: list[Hit]
    top_sim: float
    lexical_hit: bool


async def retrieve(
    user_id: str, doc_ids: list[str], queries: list[str], lexical: str | None, cfg: dict[str, Any]
) -> Retrieval:
    vecs = await embed([query_text(q) for q in queries])
    uid, dids = UUID(user_id), [UUID(d) for d in doc_ids]
    k_rrf = cfg["rrfK"]
    hits: dict[str, Hit] = {}
    async with db.pool().connection() as conn:
        for qi, v in enumerate(vecs):
            cur = await conn.execute(
                _VECTOR_SQL, {"user_id": uid, "doc_ids": dids, "q": Vector(v), "k": cfg["vectorCandidates"]}
            )
            for rank, row in enumerate(await cur.fetchall(), start=1):
                cid = str(row[0])
                h = hits.get(cid) or Hit(
                    id=cid,
                    document_id=str(row[1]),
                    page=row[2],
                    ordinal=row[3],
                    start=row[4],
                    end=row[5],
                    text=row[6],
                    text_en=row[7],
                    language=row[8],
                    injection_suspected=bool(row[9]),
                )
                h.sim = max(h.sim, float(row[10]))
                h.score += 1.0 / (k_rrf + rank)
                h.lists.add(f"v{qi}")
                hits[cid] = h
        lexical_hit = False
        if lexical and lexical.strip():
            cur = await conn.execute(
                _LEXICAL_SQL, {"user_id": uid, "doc_ids": dids, "text": lexical, "k": cfg["lexicalCandidates"]}
            )
            for rank, row in enumerate(await cur.fetchall(), start=1):
                cid = str(row[0])
                lexical_hit = True
                if cid not in hits:
                    full = await (
                        await conn.execute(
                            "SELECT id, document_id, page, ordinal, start_char, end_char, text, text_en, language, "
                            "injection_suspected FROM chunks WHERE id = %s",
                            (UUID(cid),),
                        )
                    ).fetchone()
                    if not full:
                        continue
                    hits[cid] = Hit(
                        id=cid,
                        document_id=str(full[1]),
                        page=full[2],
                        ordinal=full[3],
                        start=full[4],
                        end=full[5],
                        text=full[6],
                        text_en=full[7],
                        language=full[8],
                        injection_suspected=bool(full[9]),
                    )
                h = hits[cid]
                h.lex_rank = rank if h.lex_rank is None else min(h.lex_rank, rank)
                h.score += 1.0 / (k_rrf + rank)
                h.lists.add("lex")
    ordered = sorted(hits.values(), key=lambda h: h.score, reverse=True)
    top = max((h.sim for h in ordered), default=0.0)
    return Retrieval(hits=ordered, top_sim=top, lexical_hit=lexical_hit)


async def opening_chunks(
    user_id: str, doc_ids: list[str], per_doc: int, total: int, known: list[Hit]
) -> tuple[list[Hit], int]:
    """Each document's first chunks in reading order (≤ per_doc each, ≤ total) and the documents' chunk count.
    Similarities come from the vector search when it saw the chunk."""
    sims = {h.id: h.sim for h in known}
    async with db.pool().connection() as conn:
        cur = await conn.execute(
            _OPENING_SQL, {"user_id": UUID(user_id), "doc_ids": [UUID(d) for d in doc_ids], "per_doc": per_doc}
        )
        rows = await cur.fetchall()
    hits = [
        Hit(
            id=str(row[0]),
            document_id=str(row[1]),
            page=row[2],
            ordinal=row[3],
            start=row[4],
            end=row[5],
            text=row[6],
            text_en=row[7],
            language=row[8],
            injection_suspected=bool(row[9]),
            sim=sims.get(str(row[0]), 0.0),
        )
        for row in rows
    ]
    return hits[:total], int(rows[0][10]) if rows else 0


def _overlap(a: Hit, b: Hit) -> float:
    if a.document_id != b.document_id or a.page != b.page or a.start is None or b.start is None:
        return 0.0
    inter = max(0, min(a.end or 0, b.end or 0) - max(a.start, b.start))
    return inter / max(1, (a.end or 0) - a.start)


def select(r: Retrieval, cfg: dict[str, Any], force_top_k: int | None = None) -> list[Hit]:
    """§7.3 step 7: fused order, similarity or lexical rank, no near-duplicates, per-document and total caps."""
    out: list[Hit] = []
    per_doc: dict[str, int] = {}
    for h in r.hits:
        if force_top_k is None and not (
            h.sim >= cfg["minChunkSimilarity"] or (h.lex_rank is not None and h.lex_rank <= cfg["lexicalRankKeep"])
        ):
            continue
        if any(_overlap(h, o) >= cfg["dedupeOverlap"] for o in out):
            continue
        if per_doc.get(h.document_id, 0) >= cfg["maxChunksPerDocument"]:
            continue
        out.append(h)
        per_doc[h.document_id] = per_doc.get(h.document_id, 0) + 1
        if len(out) >= (force_top_k or cfg["maxChunks"]):
            break
    return out


async def document_names(user_id: str, doc_ids: list[str]) -> dict[str, tuple[str, str | None]]:
    async with db.pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, filename, language FROM documents WHERE user_id = %s AND id = ANY(%s)",
            (UUID(user_id), [UUID(d) for d in doc_ids]),
        )
        return {str(row[0]): (row[1], row[2]) for row in await cur.fetchall()}


async def chunk_embeddings(ids: list[str]) -> dict[str, list[float]]:
    if not ids:
        return {}
    async with db.pool().connection() as conn:
        cur = await conn.execute("SELECT id, embedding FROM chunks WHERE id = ANY(%s)", ([UUID(i) for i in ids],))
        return {str(row[0]): row[1].to_list() for row in await cur.fetchall()}
