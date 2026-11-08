"""Background removal with rembg and an explicit Apache-2.0 model (AI_SERVICE.md §10.2).

Never rembg's default `bria-rmbg` (CC BY-NC 4.0 weights).
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.errors import ServiceError

_ALLOWED = {"isnet-general-use", "birefnet-general"}
_session: Any = None
_lock = asyncio.Semaphore(1)


def _remove(src: Path, dst: Path) -> dict[str, Any]:
    global _session
    from PIL import Image
    from rembg import new_session, remove

    name = get_settings().rembg_model
    if name not in _ALLOWED:
        raise ServiceError("FEATURE_UNAVAILABLE", f"Background model {name} is not allowed.", 503)
    if _session is None:
        _session = new_session(name)
    with Image.open(src) as im:
        out = remove(im.convert("RGBA"), session=_session)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, format="PNG")
    return {"width": out.width, "height": out.height}


async def remove_background(src: Path, dst: Path) -> dict[str, Any]:
    if not await asyncio.to_thread(src.is_file):
        raise ServiceError("NOT_FOUND", "The image file is missing.", 404)
    async with _lock:
        return await asyncio.to_thread(_remove, src, dst)
