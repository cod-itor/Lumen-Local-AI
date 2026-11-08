"""Lumen AI service — FastAPI app (AI_SERVICE.md). Run: uv run uvicorn app.main:app --host 127.0.0.1 --port 8001"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db, state
from app.api import evals, harness, models, rag, system
from app.config import get_settings
from app.errors import install_error_handlers
from app.models import ollama_runtime
from app.rules.loader import load_rules

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("lumen.ai")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    s = get_settings()
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    rules = load_rules(s.rules_dir, s.app_name)  # refuses to start on invalid rules (RULES.md §2)
    state.set_rules(rules)
    log.info("Rules loaded: %s (%d modes)", rules.version, len(rules.modes))
    await db.open_pool(s.database_url)
    if s.ai_profile == "full":
        asyncio.create_task(ollama_runtime.warm_up())  # noqa: RUF006
    try:
        yield
    finally:
        await db.close_pool()


app = FastAPI(
    title="Lumen AI service", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None
)
install_error_handlers(app)
app.include_router(system.router)
app.include_router(models.router)
app.include_router(evals.router)
app.include_router(harness.router)
app.include_router(rag.router)
