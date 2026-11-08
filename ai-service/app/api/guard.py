"""POST /guard/check and /guard/check-url (AI_SERVICE.md §4.1)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from app.auth import require_internal_token
from app.errors import ServiceError
from app.guard import engine
from app.guard.url_safety import check_url
from app.harness.normalize import normalize
from app.state import rules

router = APIRouter(dependencies=[Depends(require_internal_token)])


@router.post("/guard/check")
async def guard_check(body: dict[str, Any] = Body(...)) -> dict[str, Any]:  # noqa: B008
    """Input check for non-chat text (learning goal, image prompt): `{text, kind, profile}`."""
    kind = body.get("kind") or "TEXT"
    if kind not in ("TEXT", "IMAGE_PROMPT"):
        raise ServiceError("VALIDATION_ERROR", "kind must be TEXT or IMAGE_PROMPT.", 400)
    r = rules()
    text = normalize(str(body.get("text") or ""), r.guardrails)
    profile = body.get("profile") or "STANDARD"
    d = await engine.check_input(r, text, text, profile, kind)
    key = "image_blocked" if kind == "IMAGE_PROMPT" and d.action == "BLOCK" and d.rule != "too_long" else None
    key = key or engine.refusal_key(r, d.action, d.categories, d.rule)
    return {
        "action": d.action,
        "categories": d.categories,
        "rule": d.rule,
        "wouldAction": d.would_action,
        "refusal": engine.texts(r, key) if d.action in ("BLOCK", "SUPPORT") else None,
        "guardEvents": d.events,
    }


@router.post("/guard/check-url")
async def guard_check_url(body: dict[str, Any] = Body(...)) -> dict[str, Any]:  # noqa: B008
    res = await check_url(str(body.get("url") or ""), body.get("purpose") or "REMOTE_URL")
    return {"ok": res.ok, "reason": res.reason}
