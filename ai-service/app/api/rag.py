"""POST /rag/ingest (SSE) and DELETE /rag/documents/{id} (AI_SERVICE.md §13)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends
from sse_starlette.sse import EventSourceResponse

from app.api.harness import _sse
from app.auth import require_internal_token
from app.errors import ServiceError
from app.rag.ingest import delete_document, ingest

router = APIRouter(dependencies=[Depends(require_internal_token)])


@router.post("/rag/ingest")
async def rag_ingest(body: dict[str, Any] = Body(...)) -> EventSourceResponse:  # noqa: B008
    for key in ("documentId", "userId", "path"):
        if not body.get(key):
            raise ServiceError("VALIDATION_ERROR", f"{key} is required.", 400)
    return _sse(ingest(body))


@router.delete("/rag/documents/{document_id}")
async def rag_delete(document_id: str) -> dict[str, int]:
    return {"deleted": await delete_document(document_id)}
