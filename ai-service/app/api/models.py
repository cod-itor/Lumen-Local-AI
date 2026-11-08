"""/models/catalog and /models/profile (AI_SERVICE.md §4.1, HARNESS.md §2)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app import state
from app.api.system import _installed, features, ollama_models
from app.auth import require_internal_token
from app.config import get_settings
from app.harness.profiles import resolve_profile

router = APIRouter(prefix="/models", dependencies=[Depends(require_internal_token)])


class ProfileRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    kind: Literal["HOST", "BROWSER", "LOCAL_OLLAMA", "REMOTE_URL"]
    model: str = Field(min_length=1, max_length=100)
    overrides: dict[str, Any] = Field(default_factory=dict)


@router.get("/catalog")
async def catalog() -> dict:
    s = get_settings()
    m = state.rules().models
    tags = await ollama_models(s) or []
    available = features(s)["hostChat"] and _installed(tags, s.ollama_chat_model)
    return {
        "host": {"available": available, "models": [s.ollama_chat_model] if available else []},
        "browser": {"models": m.get("browserCatalog") or []},
        "ollamaSuggestions": m.get("ollamaSuggestions") or [],
    }


@router.post("/profile")
async def profile(req: ProfileRequest) -> dict:
    return resolve_profile(state.rules().models, req.kind, req.model, req.overrides)
