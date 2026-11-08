"""Prepare pipeline P3–P13 (HARNESS.md §4) — yields SSE events."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import get_settings
from app.errors import ServiceError
from app.harness import history as hist
from app.harness.budget import est_tokens
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

    def abstain(reason: str, key: str) -> Event:
        context["metrics"]["abstainedBeforeModel"] = True
        if pipeline == "RAG":
            context["routing"]["suggestions"].append(suggestion("UPLOAD_DOCUMENT"))
        return (
            "abstained",
            {
                "reason": reason,
                **fixed_text(key, task, output_language),
                "suggestions": context["routing"]["suggestions"],
                "context": context,
            },
        )

    hits: list[Any] = []
    if pipeline == "RAG":  # P9–P10
        doc_ids = [str(d) for d in chat.get("documentIds") or []]
        if not doc_ids:
            yield abstain("NO_DOCUMENTS", "NO_DOCUMENTS")
            return
        from app.rag.retrieval import retrieve, select

        yield "status", {"stage": "RETRIEVING"}
        rcfg = r.harness["retrieval"]
        query = model_input
        prev = (req.get("previousUserMessage") or "").strip()
        refers_back = any(re.search(rf"\b{re.escape(w)}\b", query, re.IGNORECASE) for w in rcfg["pronouns"])
        if prev and (len(query.split()) <= rcfg["followUpMaxWords"] or refers_back):
            query = f"{prev[: rcfg['previousMessageChars']]} {query}"
        queries = [query]
        if original != model_input:
            queries.append(original)
        ret = await retrieve(str(user["id"]), doc_ids, queries, query if input_language == "EN" else None, rcfg)
        context["metrics"]["topSim"] = round(ret.top_sim, 4)
        if ret.top_sim < rcfg["minTopSimilarity"] and not ret.lexical_hit:
            yield abstain("NO_EVIDENCE", "RAG")
            return
        hits = select(ret, rcfg)
        if not hits:
            yield abstain("NO_EVIDENCE", "RAG")
            return
    elif pipeline == "WEB":
        raise ServiceError("NOT_IMPLEMENTED", "The WEB pipeline is not available yet.", 501)

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
    var = variables(user, task, mode, answer_lang)

    def build(evidence: list[str], hist_in: list[dict[str, str]]) -> tuple[list[dict[str, str]], int]:
        return build_messages(
            rules=r,
            mode=mode,
            task=task,
            pipeline=pipeline,
            variables=var,
            profile=profile,
            params=params,
            text=model_input,
            tools=[],
            evidence=evidence,
            notes=routing.notes,
            history=hist_in,
            injection_suspected=input_guard["injectionSuspected"],
        )

    evidence: list[str] = []
    if hits:  # §7.3 steps 7–9: fit the evidence budget, number the sources
        from app.rag.retrieval import document_names

        names = await document_names(str(user["id"]), list({h.document_id for h in hits}))
        bare, _ = build([], [])
        factor = float(profile.get("tokenFactor", 1.0))
        avail = int(profile["contextWindow"]) - params["maxTokens"] - r.harness["budgets"]["safetyTokens"]
        fixed = sum(est_tokens(m["content"], r.harness, factor) for m in bare)
        budget = min(
            r.harness["budgets"]["evidenceMaxTokens"], int(r.harness["budgets"]["evidenceMaxShare"] * (avail - fixed))
        )
        used = 0
        sources: list[dict[str, Any]] = []
        khmer_native = bool(profile.get("khmerNative"))
        for h in hits:
            filename, doc_lang = names.get(h.document_id, ("document", None))
            text = h.text_en if (h.text_en and doc_lang in ("KM", "MIXED") and not khmer_native) else h.text
            n = len(sources) + 1
            header = f"<<<SOURCE {n} | {filename}" + (f" | page {h.page}" if h.page else "") + ">>>"
            block = f"{header}\n{text}\n<<<END SOURCE {n}>>>"
            cost = est_tokens(block, r.harness, factor, messages=0)
            if used + cost > budget:
                room = budget - used - est_tokens(header, r.harness, factor, messages=0) - 12
                if room < 40 or sources:
                    break
                cut = text[: int(room * 3.0)]
                end = max(cut.rfind(". "), cut.rfind("។"))
                text = cut[: end + 1] if end > 40 else cut
                block = f"{header}\n{text}\n<<<END SOURCE {n}>>>"
                cost = est_tokens(block, r.harness, factor, messages=0)
            used += cost
            evidence.append(block)
            sources.append(
                {
                    "n": n,
                    "kind": "DOC",
                    "title": filename,
                    "documentId": h.document_id,
                    "chunkId": h.id,
                    "page": h.page,
                    "snippet": text[:300],
                    "score": round(h.sim, 4),
                    "text": text,
                }
            )
        context["sources"] = sources
        context["metrics"]["chunksUsed"] = len(sources)
        yield "sources", sources

    messages, est = build(evidence, history)
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
