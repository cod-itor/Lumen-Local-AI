"""POST /rag/ingest (AI_SERVICE.md §13): parse → clean → chunk → embed → save, streaming progress."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from uuid import UUID

from pgvector import Vector

from app import db
from app.config import get_settings
from app.errors import ServiceError
from app.harness.language import detect_language
from app.models.embeddings import BATCH, doc_text, embed
from app.rag.chunking import chunk_pages
from app.rag.parse import clean, parse
from app.state import rules

Event = tuple[str, dict[str, Any]]


def _inside(root: Path, rel: str) -> Path:
    p = (root / rel).resolve()
    if not p.is_relative_to(root.resolve()):
        raise ServiceError("VALIDATION_ERROR", "path must stay inside STORAGE_DIR.", 400)
    return p


async def ingest(req: dict[str, Any]) -> AsyncIterator[Event]:
    r = rules()
    s = get_settings()
    doc_uuid, user_uuid = UUID(str(req["documentId"])), UUID(str(req["userId"]))
    doc_id, user_id = str(doc_uuid), str(user_uuid)
    path = _inside(s.storage_dir, str(req["path"]))
    filename = str(req.get("filename") or path.name)
    title = Path(filename).stem or "none"

    yield "progress", {"stage": "PARSING", "current": 0, "total": 1}
    raw, paginated = await asyncio.to_thread(parse, path, str(req.get("mime") or ""))
    pages = clean(raw, r.guardrails)
    if not any(p.strip() for p in pages):
        raise ServiceError("EMPTY_DOCUMENT", "This document has no text.", 422)

    pages_dir = _inside(s.storage_dir, f"users/{user_id}/documents/{doc_id}/pages")
    pages_dir.mkdir(parents=True, exist_ok=True)
    for n, text in enumerate(pages, start=1):
        (pages_dir / f"{n}.txt").write_text(text, "utf-8")
    yield "progress", {"stage": "PARSING", "current": 1, "total": 1}

    language = detect_language("\n".join(pages)[:20000], r.harness)
    chunks = chunk_pages(pages, paginated, r.harness)
    if not chunks:
        raise ServiceError("EMPTY_DOCUMENT", "This document has no text.", 422)
    # Translation of Khmer chunks (text_en) arrives with the translation model (phase 8); injection scoring with
    # the guardrails engine (phase 7).

    vectors: list[list[float]] = []
    total = len(chunks)
    for i in range(0, total, BATCH):
        batch = chunks[i : i + BATCH]
        vectors += await embed([doc_text(title, c.text) for c in batch])
        yield "progress", {"stage": "EMBEDDING", "current": min(total, i + BATCH), "total": total}

    yield "progress", {"stage": "SAVING", "current": 0, "total": total}
    rows = [
        (user_uuid, doc_uuid, c.ordinal, c.page, c.start, c.end, c.text, detect_language(c.text, r.harness), Vector(v))
        for c, v in zip(chunks, vectors, strict=True)
    ]
    async with db.pool().connection() as conn, conn.transaction():
        await conn.execute("DELETE FROM chunks WHERE document_id = %s", (doc_uuid,))
        async with conn.cursor() as cur:
            for i in range(0, len(rows), 100):
                await cur.executemany(
                    "INSERT INTO chunks (user_id, document_id, source, ordinal, page, start_char, end_char, text, "
                    "language, injection_suspected, embedding) "
                    "VALUES (%s, %s, 'DOC', %s, %s, %s, %s, %s, %s, false, %s)",
                    rows[i : i + 100],
                )
    yield "done", {"pages": len(pages) if paginated else None, "chunkCount": len(chunks), "language": language}


async def delete_document(doc_id: str) -> int:
    async with db.pool().connection() as conn:
        cur = await conn.execute("DELETE FROM chunks WHERE document_id = %s", (UUID(doc_id),))
        return cur.rowcount
