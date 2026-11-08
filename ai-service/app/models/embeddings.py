"""Embeddings through Ollama `/api/embed` (AI_SERVICE.md §7.2): EmbeddingGemma with its exact task prefixes."""

from __future__ import annotations

import math

import httpx

from app.config import get_settings
from app.errors import ServiceError

BATCH = 32


def query_text(text: str) -> str:
    return f"task: search result | query: {text}"


def doc_text(title: str | None, text: str) -> str:
    return f"title: {title or 'none'} | text: {text}"


def _unit(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


async def embed(texts: list[str]) -> list[list[float]]:
    """Unit-length vectors (cosine = dot product), batched by 32."""
    if not texts:
        return []
    s = get_settings()
    out: list[list[float]] = []
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
            for i in range(0, len(texts), BATCH):
                r = await client.post(
                    f"{s.ollama_host}/api/embed",
                    json={
                        "model": s.ollama_embed_model,
                        "input": texts[i : i + BATCH],
                        "keep_alive": s.ollama_keep_alive,
                    },
                )
                r.raise_for_status()
                vecs = r.json().get("embeddings") or []
                if len(vecs) != len(texts[i : i + BATCH]):
                    raise ServiceError("EMBED_FAILED", "The embedding model returned too few vectors.", 502)
                out += [_unit(v) for v in vecs]
    except httpx.HTTPError as e:
        raise ServiceError(
            "EMBED_FAILED", "The embedding model is not available. Is Ollama running?", 503, {"retryable": True}
        ) from e
    for v in out:
        if len(v) != s.embed_dim:
            raise ServiceError("EMBED_FAILED", f"Embedding size {len(v)} does not match EMBED_DIM={s.embed_dim}.", 500)
    return out


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=False))
