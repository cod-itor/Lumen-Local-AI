"""POST /images/generate, /images/variations (SSE) and /images/remove-background (AI_SERVICE.md §10)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends
from sse_starlette.sse import EventSourceResponse

from app.api.harness import _sse
from app.api.system import features
from app.auth import require_internal_token
from app.config import get_settings
from app.errors import ServiceError

router = APIRouter(dependencies=[Depends(require_internal_token)])


def _inside(rel: str) -> Path:
    root = get_settings().storage_dir.resolve()
    p = (root / rel).resolve()
    if not p.is_relative_to(root) or p.suffix.lower() != ".png":
        raise ServiceError("VALIDATION_ERROR", "paths must be .png files inside STORAGE_DIR.", 400)
    return p


def _job(body: dict[str, Any]) -> dict[str, Any]:
    if not features(get_settings())["images"]:
        raise ServiceError("FEATURE_UNAVAILABLE", "Image generation is not installed on this machine.", 503)
    prompt = str(body.get("prompt") or "").strip()
    if not 1 <= len(prompt) <= 1000:
        raise ServiceError("VALIDATION_ERROR", "prompt must be 1–1000 characters.", 400)
    width, height = int(body.get("width") or 1024), int(body.get("height") or 1024)
    if not (256 <= width <= 1536 and 256 <= height <= 1536 and width % 16 == 0 and height % 16 == 0):
        raise ServiceError("VALIDATION_ERROR", "width/height must be 256–1536 and multiples of 16.", 400)
    steps = int(body.get("steps") or 4)
    if not 1 <= steps <= 8:
        raise ServiceError("VALIDATION_ERROR", "steps must be 1–8.", 400)
    outputs = [_inside(str(x)) for x in body.get("outputPaths") or []]
    if not 1 <= len(outputs) <= 4:
        raise ServiceError("VALIDATION_ERROR", "outputPaths needs 1–4 paths.", 400)
    seed = body.get("seed")
    return {
        "prompt": prompt,
        "width": width,
        "height": height,
        "steps": steps,
        "seed": int(seed) if seed is not None else None,
        "outputs": outputs,
    }


def _relative(events: Any) -> Any:
    root = get_settings().storage_dir.resolve()

    async def gen() -> Any:
        async for name, data in events:
            if name == "done":
                data = {
                    **data,
                    "images": [{**i, "path": str(Path(i["path"]).relative_to(root))} for i in data["images"]],
                }
            yield name, data

    return gen()


@router.post("/images/generate")
async def images_generate(body: dict[str, Any] = Body(...)) -> EventSourceResponse:  # noqa: B008
    from app.images.flux import generate

    return _sse(_relative(generate(**_job(body))))


@router.post("/images/variations")
async def images_variations(body: dict[str, Any] = Body(...)) -> EventSourceResponse:  # noqa: B008
    """Same prompt with new seeds (the installed pipeline is used prompt-only)."""
    from app.images.flux import generate

    job = _job({**body, "seed": None})
    return _sse(_relative(generate(**job)))


@router.post("/images/remove-background")
async def images_remove_background(body: dict[str, Any] = Body(...)) -> dict[str, Any]:  # noqa: B008
    from app.images.background import remove_background

    if not features(get_settings())["bgRemoval"]:
        raise ServiceError("FEATURE_UNAVAILABLE", "Background removal is not installed on this machine.", 503)
    src, dst = _inside(str(body.get("inputPath") or "")), _inside(str(body.get("outputPath") or ""))
    info = await remove_background(src, dst)
    return {"outputPath": str(dst.relative_to(get_settings().storage_dir.resolve())), **info}
