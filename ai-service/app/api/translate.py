"""POST /translate (AI_SERVICE.md §4.1): Markdown-safe EN ↔ KM translation."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from app.auth import require_internal_token
from app.errors import ServiceError
from app.models.translator import translate_markdown

router = APIRouter(dependencies=[Depends(require_internal_token)])


@router.post("/translate")
async def translate(body: dict[str, Any] = Body(...)) -> dict[str, str]:  # noqa: B008
    src, tgt = body.get("source"), body.get("target")
    if {src, tgt} != {"EN", "KM"}:
        raise ServiceError("VALIDATION_ERROR", "source/target must be EN and KM.", 400)
    out = await translate_markdown(str(body.get("text") or ""), src, tgt)
    if out is None:
        raise ServiceError("FEATURE_UNAVAILABLE", "Translation is not available.", 503)
    return {"text": out}
