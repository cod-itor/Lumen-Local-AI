"""FLUX.2 [klein] 4B image generation (AI_SERVICE.md §10.1). One job at a time; unloaded after each job."""

from __future__ import annotations

import asyncio
import gc
import logging
import random
import time
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.errors import ServiceError

log = logging.getLogger(__name__)

_lock = asyncio.Semaphore(1)
_model: Any = None


def _load() -> Any:
    global _model
    if _model is None:
        s = get_settings()
        if s.image_backend != "mflux":
            raise ServiceError("FEATURE_UNAVAILABLE", "Only the mflux image backend is set up on this machine.", 503)
        from mflux.models.common.config import ModelConfig
        from mflux.models.flux2.variants import Flux2Klein

        _model = Flux2Klein(model_config=ModelConfig.flux2_klein_4b(), model_path=str(s.image_model_dir))
    return _model


def _unload() -> None:
    global _model
    _model = None
    gc.collect()
    try:
        import mlx.core as mx

        mx.clear_cache()
    except Exception as e:  # noqa: BLE001 — best effort
        log.debug("mlx cache clear skipped: %s", e)


def _one(prompt: str, seed: int, steps: int, width: int, height: int, out: Path) -> dict[str, Any]:
    t0 = time.monotonic()
    img = _load().generate_image(
        seed=seed, prompt=prompt, num_inference_steps=steps, width=width, height=height, guidance=1.0
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    img.image.save(out, format="PNG") if hasattr(img, "image") else img.save(str(out))
    return {"width": width, "height": height, "seed": seed, "durationMs": int((time.monotonic() - t0) * 1000)}


async def generate(*, prompt: str, width: int, height: int, seed: int | None, steps: int, outputs: list[Path]) -> Any:
    """Yields progress events, then `done`. Seeds: seed, seed+1, … or random 31-bit per image."""
    total = len(outputs)
    if _lock.locked():
        yield "progress", {"stage": "QUEUED", "current": 0, "total": total}
    async with _lock:
        try:
            if _model is None:
                yield "progress", {"stage": "LOADING_MODEL", "current": 0, "total": total}
                await asyncio.to_thread(_load)
            images: list[dict[str, Any]] = []
            for i, out in enumerate(outputs):
                yield "progress", {"stage": "GENERATING", "current": i + 1, "total": total}
                sd = (seed + i) if seed is not None else random.randrange(1, 2**31)  # noqa: S311 — image seeds, not security
                info = await asyncio.to_thread(_one, prompt, sd, steps, width, height, out)
                images.append({"path": str(out), **info})
            yield "done", {"images": images, "model": "FLUX.2-klein-4B (mflux 4-bit)"}
        finally:
            if get_settings().image_unload_after_job:
                await asyncio.to_thread(_unload)
