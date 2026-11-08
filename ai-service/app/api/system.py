"""/health, /capabilities, /status, /rules/reload (AI_SERVICE.md §4.1)."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from app import db, state
from app.auth import require_internal_token
from app.config import Settings, get_settings
from app.errors import ServiceError
from app.rules.loader import RulesInvalid, load_rules

router = APIRouter(dependencies=[Depends(require_internal_token)])


def features(s: Settings) -> dict[str, bool]:
    """Effective feature flags: profile defaults, then FEATURE_* overrides (AI_SERVICE.md §1)."""
    full = s.ai_profile == "full"

    def pick(override: bool | None, default: bool) -> bool:
        return default if override is None else override

    image_lib = "mflux" if s.image_backend == "mflux" else "diffusers"
    # A feature is on only when the profile allows it AND its model/library is actually installed, so the
    # frontend never offers something that would fail (models are downloaded per feature to save disk).
    return {
        "hostChat": pick(s.feature_host_chat, full),
        "images": pick(s.feature_images, full) and _module_available(image_lib) and _image_model_ready(s),
        "bgRemoval": pick(s.feature_bg_removal, True) and _module_available("rembg"),
        "voice": pick(s.feature_voice, True) and _module_available("faster_whisper") and _voice_model_ready(s),
        "tts": pick(s.feature_tts, False),
        "translation": pick(s.feature_translation, True) and (s.translation_model_dir / "model.bin").is_file(),
        "webSearch": pick(s.feature_web_search, True),
        "guardClassifier": s.guard_injection_classifier or s.guard_content_classifier,
    }


def _image_model_ready(s: Settings) -> bool:
    if s.image_backend != "mflux":
        return True  # diffusers downloads into the Hugging Face cache on first use
    return (s.image_model_dir / "transformer").is_dir() or any(s.image_model_dir.glob("*.safetensors"))


def _voice_model_ready(s: Settings) -> bool:
    return (s.models_dir / f"faster-whisper-{s.whisper_en_model}" / "model.bin").is_file()


def _module_available(name: str) -> bool:
    import importlib.util

    return importlib.util.find_spec(name) is not None


async def ollama_models(s: Settings) -> list[str] | None:
    """Installed Ollama model tags, or None if Ollama is not reachable."""
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            r = await client.get(f"{s.ollama_host}/api/tags")
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
    except (httpx.HTTPError, ValueError, KeyError):
        return None


def _installed(tags: list[str], model: str) -> bool:
    return model in tags or f"{model}:latest" in tags


@router.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "ollama": await ollama_models(s) is not None,
        "db": await db.ping(),
        "profile": s.ai_profile,
    }


@router.get("/capabilities")
async def capabilities() -> dict:
    s = get_settings()
    f = features(s)
    tags = await ollama_models(s) or []
    host_models = [s.ollama_chat_model] if f["hostChat"] and _installed(tags, s.ollama_chat_model) else []
    f["hostChat"] = bool(host_models)
    return {
        "profile": s.ai_profile,
        "features": f,
        "hostChatModels": host_models,
        "defaultChatModel": s.ollama_chat_model,
        "embedModel": s.ollama_embed_model,
        "embedDim": s.embed_dim,
        "rulesVersion": state.rules().version,
    }


@router.get("/status")
async def status() -> dict:
    s = get_settings()
    loaded: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            r = await client.get(f"{s.ollama_host}/api/ps")
            loaded = [{"name": m["name"], "sizeMb": round(m.get("size", 0) / 1_048_576)} for m in r.json()["models"]]
    except (httpx.HTTPError, ValueError, KeyError):
        pass
    return {
        "loadedModels": loaded,
        "queue": {"heavyJobsQueued": 0, "heavyJobRunning": False, "serverTurnsActive": 0, "serverTurnsQueued": 0},
    }


@router.post("/rules/reload")
async def reload_rules() -> dict:
    s = get_settings()
    try:
        new = load_rules(s.rules_dir, s.app_name)
    except RulesInvalid as e:
        raise ServiceError(
            "RULES_INVALID", "The new rules failed validation; the old rules stay active.", 422, {"errors": e.errors}
        ) from e
    state.set_rules(new)
    return {"rulesVersion": new.version, "loadedAt": new.loaded_at.isoformat().replace("+00:00", "Z")}
