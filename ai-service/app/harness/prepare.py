"""Prepare pipeline P3–P13 (HARNESS.md §4) — yields SSE events."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import get_settings
from app.errors import ServiceError
from app.harness import history as hist
from app.harness.language import answer_language, detect_language
from app.harness.normalize import normalize
from app.harness.params import build_params, client_guard, max_words
from app.harness.prompt_builder import build_messages, prompt_hash
from app.harness.router import route, suggestion
from app.state import rules

Event = tuple[str, dict[str, Any]]


def _now(user: dict[str, Any]) -> tuple[datetime, str]:
    tz_name = user.get("timezone") or "Asia/Phnom_Penh"
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        tz_name, tz = "UTC", ZoneInfo("UTC")
    raw = user.get("now")
    now = datetime.fromisoformat(raw.replace("Z", "+00:00")) if raw else datetime.now(UTC)
    return now.astimezone(tz), tz_name


def variables(user: dict[str, Any], task: str, mode: Any, answer_lang: str) -> dict[str, Any]:
    local, tz_name = _now(user)
    return {
        "APP_NAME": get_settings().app_name,
        "TODAY": f"{local.day} {local:%B %Y}",
        "WEEKDAY": f"{local:%A}",
        "TIMEZONE": tz_name,
        "ANSWER_LANGUAGE": answer_lang,
        "MAX_WORDS": max_words(task, mode, user.get("answerLength") or "NORMAL", rules().harness),
        "COUNT": 5,
        "SOURCE_LANGUAGE": "English",
        "TARGET_LANGUAGE": "Khmer",
        "EMERGENCY_LINE": "",
    }


def fixed_text(key: str, task: str, output_language: str) -> dict[str, Any]:
    """content/originalContent/translations for a prepared EN/KM text (AI_SERVICE.md §4.2)."""
    pair = rules().guardrails["abstain"][key]
    if task != "MESSAGE":
        return {
            "content": pair["KM"] if output_language == "KM" else pair["EN"],
            "originalContent": None,
            "translations": {},
        }
    if output_language == "KM":
        return {"content": pair["KM"], "originalContent": pair["EN"], "translations": {}}
    if output_language == "BOTH":
        return {"content": pair["EN"], "originalContent": None, "translations": {"KM": pair["KM"]}}
    return {"content": pair["EN"], "originalContent": None, "translations": {}}


async def prepare(req: dict[str, Any]) -> AsyncIterator[Event]:
    r = rules()
    task = req["task"]
    user = req["user"]
    provider = req["provider"]
    profile = provider.get("profile") or {}
    chat = req.get("chat") or {}
    inp = req.get("input") or {}
    output_language = user.get("outputLanguage") or "EN"
    from app.api.system import features

    feats = features(get_settings())

    if task != "MESSAGE":
        raise ServiceError("NOT_IMPLEMENTED", f"Task {task} is not available yet.", 501)

    yield "status", {"stage": "CHECKING_INPUT"}
    original = normalize(inp.get("content") or "", r.guardrails)  # P3
    input_language = detect_language(original, r.harness)  # P4
    input_guard = {"action": "ALLOW", "categories": [], "injectionSuspected": False, "wouldAction": None}  # P5
    model_input = original  # P6 (pivot: translation)
    answer_lang = answer_language(task, output_language, profile)

    yield "status", {"stage": "ROUTING"}
    local, _ = _now(user)
    routing = route(
        r,
        task=task,
        tab=chat.get("tab"),
        web_search=bool(inp.get("webSearch")),
        web_enabled=feats["webSearch"],
        original=original,
        model_input=model_input,
        current_year=local.year,
    )  # P7
    pipeline = routing.pipeline
    mode = r.mode_for(task, pipeline)

    context: dict[str, Any] = {
        "pipeline": pipeline,
        "inputLanguage": input_language,
        "outputLanguage": output_language,
        "answerLanguage": answer_lang,
        "modelInput": model_input,
        "sources": [],
        "tools": [],
        "routing": routing.to_json(),
        "inputGuard": input_guard,
        "params": None,
        "outputSchemaId": mode.schema,
        "promptHash": None,
        "rulesVersion": r.version,
        "mode": mode.tag,
        "metrics": {"estimatedPromptTokens": None, "topSim": None, "chunksUsed": 0, "abstainedBeforeModel": False},
    }

    if pipeline == "RAG" and not chat.get("documentIds"):  # P10
        context["metrics"]["abstainedBeforeModel"] = True
        context["routing"]["suggestions"].append(suggestion("UPLOAD_DOCUMENT"))
        yield (
            "abstained",
            {
                "reason": "NO_DOCUMENTS",
                **fixed_text("RAG", task, output_language),
                "suggestions": context["routing"]["suggestions"],
                "context": context,
            },
        )
        return
    if pipeline in ("RAG", "WEB"):
        raise ServiceError("NOT_IMPLEMENTED", f"The {pipeline} pipeline is not available yet.", 501)

    yield "status", {"stage": "BUILDING_PROMPT"}
    params = build_params(
        task=task,
        mode=mode,
        pipeline=pipeline,
        profile=profile,
        kind=provider["kind"],
        user=user,
        harness=r.harness,
        greeting="GREETING" in routing.intents,
    )  # P13 (needed by budget)
    history = hist.prepare_history(req.get("history") or [], pipeline or "CHAT", r.harness)
    messages, est = build_messages(
        rules=r,
        mode=mode,
        task=task,
        pipeline=pipeline,
        variables=variables(user, task, mode, answer_lang),
        profile=profile,
        params=params,
        text=model_input,
        tools=[],
        evidence=[],
        notes=routing.notes,
        history=history,
        injection_suspected=input_guard["injectionSuspected"],
    )
    context["params"] = params
    context["promptHash"] = prompt_hash(messages)
    context["metrics"]["estimatedPromptTokens"] = est
    yield (
        "prepared",
        {
            "messages": messages,
            "params": params,
            "outputSchema": None,
            "modelProfile": profile,
            "clientGuard": client_guard(params, r.harness, r.guardrails),
            "context": context,
            "guardEvents": [],
        },
    )
