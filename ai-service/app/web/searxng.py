"""SearXNG JSON search (AI_SERVICE.md §7.5).

SearXNG is our own local service, so it is not URL-checked; its results are.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings
from app.errors import ServiceError


async def search(query: str, safesearch: int, limit: int) -> list[dict[str, Any]]:
    s = get_settings()
    params = {"q": query, "format": "json", "language": "en", "safesearch": safesearch, "categories": "general"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(f"{s.searxng_url}/search", params=params)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError) as e:
        raise ServiceError("WEB_UNAVAILABLE", "Web search is unavailable.", 503, {"retryable": True}) from e
    out = []
    for item in data.get("results") or []:
        url = str(item.get("url") or "")
        if url:
            out.append(
                {
                    "title": str(item.get("title") or ""),
                    "url": url,
                    "content": str(item.get("content") or ""),
                    "publishedDate": item.get("publishedDate"),
                }
            )
        if len(out) >= limit * 2:
            break
    return out
