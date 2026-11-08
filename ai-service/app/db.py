"""Async Postgres pool with pgvector registered on every connection."""

from __future__ import annotations

import logging

from pgvector.psycopg import register_vector_async
from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

log = logging.getLogger(__name__)
_pool: AsyncConnectionPool | None = None


async def _configure(conn: AsyncConnection) -> None:
    try:
        await register_vector_async(conn)
    except Exception:  # noqa: BLE001 — the vector type exists only after the backend's Flyway migration ran
        log.warning("pgvector type not found yet; run the backend once so Flyway creates the schema")


async def open_pool(url: str) -> AsyncConnectionPool:
    global _pool
    _pool = AsyncConnectionPool(url, min_size=1, max_size=10, open=False, configure=_configure,
                                kwargs={"autocommit": True})
    await _pool.open(wait=False)
    return _pool


def pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("DB pool not opened")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def ping() -> bool:
    if _pool is None:
        return False
    try:
        async with _pool.connection(timeout=2) as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception:  # noqa: BLE001
        return False
