"""/harness/prepare (SSE), /generate (SSE), /harness/finalize (AI_SERVICE.md §4.2–4.4)."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Body, Depends
from sse_starlette.sse import EventSourceResponse

from app.auth import require_internal_token
from app.errors import ServiceError
from app.harness.finalize import finalize
from app.harness.prepare import prepare
from app.models import ollama_runtime

router = APIRouter(dependencies=[Depends(require_internal_token)])
log = logging.getLogger("lumen.harness")


def _sse(events: AsyncIterator[tuple[str, dict[str, Any]]]) -> EventSourceResponse:
    async def gen() -> AsyncIterator[dict[str, str]]:
        try:
            async for name, data in events:
                yield {"event": name, "data": json.dumps(data, ensure_ascii=False)}
        except ServiceError as e:
            yield {
                "event": "error",
                "data": json.dumps(
                    {"code": e.code, "message": e.message, "retryable": bool(e.extra.get("retryable", False))}
                ),
            }
        except Exception:
            log.exception("stream failed")
            yield {
                "event": "error",
                "data": json.dumps({"code": "INTERNAL_ERROR", "message": "AI service error.", "retryable": True}),
            }

    return EventSourceResponse(gen(), ping=15)


@router.post("/harness/prepare")
async def harness_prepare(body: dict[str, Any] = Body(...)) -> EventSourceResponse:  # noqa: B008
    if not body.get("task") or not body.get("user") or not body.get("provider"):
        raise ServiceError("VALIDATION_ERROR", "task, user and provider are required.", 400)
    return _sse(prepare(body))


@router.post("/generate")
async def generate(body: dict[str, Any] = Body(...)) -> EventSourceResponse:  # noqa: B008
    target = body.get("target") or {}
    if target.get("kind") != "HOST":
        raise ServiceError("NOT_IMPLEMENTED", "Only HOST generation is available.", 501)
    if not body.get("messages") or not body.get("params"):
        raise ServiceError("VALIDATION_ERROR", "messages and params are required.", 400)
    return _sse(ollama_runtime.generate(body))


@router.post("/harness/finalize")
async def harness_finalize(body: dict[str, Any] = Body(...)) -> dict[str, Any]:  # noqa: B008
    if not body.get("task") or "output" not in body:
        raise ServiceError("VALIDATION_ERROR", "task and output are required.", 400)
    return await finalize(body)
