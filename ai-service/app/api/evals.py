"""/evals/suites (AI_SERVICE.md §4.1)."""

from fastapi import APIRouter, Depends

from app import state
from app.auth import require_internal_token
from app.errors import ServiceError

router = APIRouter(prefix="/evals", dependencies=[Depends(require_internal_token)])


@router.get("/suites")
async def suites() -> list[dict]:
    return [
        {
            "id": s.id,
            "version": s.version,
            "quickCount": s.quick_count,
            "fullCount": len(s.cases),
            "categories": s.categories,
        }
        for s in state.rules().suites.values()
    ]


@router.get("/suites/{suite_id}")
async def suite(suite_id: str) -> dict:
    s = state.rules().suites.get(suite_id)
    if s is None:
        raise ServiceError("NOT_FOUND", "Unknown suite.", 404)
    ev = state.rules().harness.get("evals") or {}
    return {
        "id": s.id,
        "version": s.version,
        "cases": [{"id": c.id, "category": c.category, "quick": c.quick, "task": c.task} for c in s.cases],
        "weights": ev.get("weights") or {},
        "maxErrorResults": int(ev.get("maxErrorResults") or 5),
    }
