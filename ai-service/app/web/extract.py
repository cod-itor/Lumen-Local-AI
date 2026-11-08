"""Main-text extraction with trafilatura (HARNESS.md §7.4 step 5)."""

from __future__ import annotations

import asyncio
import json
from typing import Any


def _extract(html: str, url: str) -> dict[str, Any] | None:
    import trafilatura

    raw = trafilatura.extract(
        html,
        url=url,
        output_format="json",
        with_metadata=True,
        favor_precision=True,
        include_comments=False,
        include_tables=True,
        include_links=False,
        include_images=False,
    )
    if not raw:
        return None
    d = json.loads(raw)
    return {"title": d.get("title"), "text": d.get("text") or "", "date": d.get("date"), "site": d.get("sitename")}


async def extract(body: bytes, charset: str | None, content_type: str, url: str) -> dict[str, Any] | None:
    text = body.decode(charset or "utf-8", errors="replace")
    if content_type == "text/plain":
        return {"title": None, "text": text, "date": None, "site": None}
    return await asyncio.to_thread(_extract, text, url)
