"""WEB evidence (HARNESS.md §7.4): query → SearXNG → filter → fetch → extract → chunk → embed → cache → rank."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlsplit

from pgvector import Vector

from app import db
from app.config import get_settings
from app.guard.markdown_policy import norm_url
from app.guard.url_safety import check_static, safe_get
from app.models.embeddings import doc_text, dot, embed, query_text
from app.rules.models import Rules

log = logging.getLogger(__name__)


@dataclass
class WebChunk:
    id: str
    url: str
    title: str
    site_name: str
    published_at: str | None
    text: str
    injection_suspected: bool
    embedding: list[float]
    sim: float = 0.0


@dataclass
class WebEvidence:
    chunks: list[WebChunk] = field(default_factory=list)
    skipped_injection: int = 0
    pages: int = 0


def build_query(model_input: str, previous: str | None, r: Rules) -> str:
    """§7.4 step 1: pronoun/follow-up rule of §7.3, filler removed, trailing ? dropped, ≤ 20 words / 200 chars."""
    w = r.harness["web"]
    rcfg = r.harness["retrieval"]
    q = model_input.strip()
    prev = (previous or "").strip()
    refers_back = any(re.search(rf"\b{re.escape(p)}\b", q, re.IGNORECASE) for p in rcfg["pronouns"])
    if prev and (len(q.split()) <= rcfg["followUpMaxWords"] or refers_back):
        q = f"{prev[: rcfg['previousMessageChars']]} {q}"
    changed = True
    while changed:
        changed = False
        for f in sorted(w["fillerPrefixes"], key=len, reverse=True):
            m = re.match(rf"^\s*{re.escape(f)}\b[\s,:]*", q, re.IGNORECASE)
            if m and m.end() < len(q):
                q = q[m.end() :]
                changed = True
    q = re.sub(r"\s+", " ", q).strip().rstrip("?").strip()
    q = " ".join(q.split()[: int(w["queryMaxWords"])])
    return q[: int(w["queryMaxChars"])].strip()


def site_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def _allowed(url: str, r: Rules) -> bool:
    w = r.harness["web"]
    if not check_static(url, "WEB").ok:
        return False
    path = urlsplit(url).path.lower()
    if any(path.endswith(ext) for ext in w["skipExtensions"]):
        return False
    site = site_of(url)
    blocked = [d.lower().removeprefix("www.") for d in (r.guardrails.get("web") or {}).get("blockedDomains") or []]
    return not any(site == d or site.endswith("." + d) for d in blocked)


async def _cached(url_hash: str, hours: int) -> list[WebChunk] | None:
    async with db.pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, url, title, site_name, published_at, text, injection_suspected, embedding FROM chunks "
            "WHERE source = 'WEB' AND url_hash = %s AND fetched_at > now() - make_interval(hours => %s) "
            "ORDER BY ordinal",
            (url_hash, hours),
        )
        rows = await cur.fetchall()
    if not rows:
        return None
    return [WebChunk(str(x[0]), x[1], x[2] or "", x[3] or "", x[4], x[5], bool(x[6]), x[7].to_list()) for x in rows]


async def _fetch_page(url: str, title_hint: str, published: str | None, r: Rules) -> list[WebChunk]:
    from app.guard.engine import untrusted_score
    from app.harness.language import detect_language
    from app.harness.normalize import normalize
    from app.rag.chunking import chunk_pages
    from app.web.extract import extract

    w = r.harness["web"]
    s = get_settings()
    url_hash = hashlib.sha256(norm_url(url).encode()).hexdigest()
    cached = await _cached(url_hash, int(w["cacheHours"]))
    if cached is not None:
        return cached
    try:
        page = await safe_get(
            url,
            headers={
                "User-Agent": f"StudyAssistantBot/1.0 (+{s.public_url})",
                "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9",
            },
            max_bytes=int(w["maxPageBytes"]),
            time_limit=float(w["fetchTimeoutSeconds"]),
            max_redirects=int(w["maxRedirects"]),
        )
    except Exception as e:  # noqa: BLE001 — any fetch failure (blocked URL, network, TLS) skips the result
        log.info("skip %s: %s", site_of(url), getattr(e, "reason", type(e).__name__))
        return []
    if page.status != 200 or page.content_type not in w["allowedContentTypes"]:
        return []
    ex = await extract(page.body, page.charset, page.content_type, page.url)
    if not ex:
        return []
    text = normalize(ex["text"], r.guardrails)
    if len(text) < int(w["minPageChars"]):
        return []
    title = (ex.get("title") or title_hint or site_of(url))[:500]
    site = site_of(page.url)[:255]
    pub = str(ex.get("date") or published or "")[:40] or None
    harness = {**r.harness, "chunking": {**r.harness["chunking"], "targetTokens": int(w["chunkTokens"])}}
    pieces = chunk_pages([text], False, harness)
    if not pieces:
        return []
    vecs = await embed([doc_text(title, c.text) for c in pieces])
    threshold = float(r.guardrails["classifiers"]["injection"]["threshold"])
    out: list[WebChunk] = []
    async with db.pool().connection() as conn:
        await conn.execute("DELETE FROM chunks WHERE source = 'WEB' AND url_hash = %s", (url_hash,))
        for c, v in zip(pieces, vecs, strict=True):
            flagged = untrusted_score(r, c.text) >= threshold
            cur = await conn.execute(
                "INSERT INTO chunks (user_id, document_id, source, ordinal, page, start_char, end_char, text, "
                "language, injection_suspected, url, url_hash, title, site_name, published_at, fetched_at, embedding) "
                "VALUES (NULL, NULL, 'WEB', %s, NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s) RETURNING id",
                (
                    c.ordinal,
                    c.start,
                    c.end,
                    c.text,
                    detect_language(c.text, r.harness),
                    flagged,
                    page.url[:2000],
                    url_hash,
                    title,
                    site,
                    pub,
                    Vector(v),
                ),
            )
            row = await cur.fetchone()
            out.append(WebChunk(str(row[0]), page.url, title, site, pub, c.text, flagged, v))  # type: ignore[index]
    return out


async def search_results(query: str, safesearch: int, r: Rules) -> list[dict[str, Any]]:
    """Step 2. Raises ServiceError(WEB_UNAVAILABLE) when SearXNG is unreachable."""
    from app.web.searxng import search

    return await search(query, safesearch, int(r.harness["web"]["maxResults"]))


async def gather(query: str, results: list[dict[str, Any]], r: Rules) -> WebEvidence:
    """Steps 3–8: filter, fetch, extract, chunk, embed, cache, rank."""
    w = r.harness["web"]
    picked: list[dict[str, Any]] = []
    per_domain: dict[str, int] = {}
    seen: set[str] = set()
    for res in results:
        url = res["url"]
        key = norm_url(url)
        if key in seen or not _allowed(url, r):
            continue
        site = site_of(url)
        if per_domain.get(site, 0) >= int(w["maxPerDomain"]):
            continue
        seen.add(key)
        per_domain[site] = per_domain.get(site, 0) + 1
        picked.append(res)
        if len(picked) >= int(w["maxPagesToFetch"]):
            break
    pages = await asyncio.gather(*[_fetch_page(p["url"], p["title"], p.get("publishedDate"), r) for p in picked])
    ev = WebEvidence(pages=sum(1 for p in pages if p))
    if not any(pages):
        return ev
    (qv,) = await embed([query_text(query)])
    ranked: list[WebChunk] = []
    for chunks in pages:
        for c in chunks:
            c.sim = dot(qv, c.embedding)
        keep = [c for c in chunks if not c.injection_suspected]
        ev.skipped_injection += len(chunks) - len(keep)
        ranked += sorted(keep, key=lambda c: c.sim, reverse=True)[: int(w["maxChunksPerPage"])]
    ev.chunks = sorted(ranked, key=lambda c: c.sim, reverse=True)[: int(w["maxChunks"])]
    return ev


async def purge_old(hours: int) -> int:
    async with db.pool().connection() as conn:
        cur = await conn.execute(
            "DELETE FROM chunks WHERE source = 'WEB' AND fetched_at < now() - make_interval(hours => %s)", (hours,)
        )
        return cur.rowcount or 0
