"""Finalize pipeline F1–F15 (HARNESS.md §9)."""

from __future__ import annotations

from typing import Any

from app.harness import structured
from app.harness.loops import cut_loop, detect_loop
from app.harness.normalize import normalize
from app.harness.reasoning import strip_reasoning
from app.harness.router import suggestion
from app.state import rules


def _close_fence(text: str) -> str:
    return text + "\n```" if text.count("```") % 2 == 1 else text


def _metrics(level: str | None, ratio: float | None, guard_action: str, attempt: int) -> dict[str, Any]:
    return {
        "groundingLevel": level,
        "supportedRatio": ratio,
        "guardOutputAction": guard_action,
        "jsonAttempts": attempt,
    }


def _khmer_ratio(text: str) -> float:
    from app.harness.sentences import KHMER_RUN

    letters = sum(1 for ch in text if ch.isalpha() or KHMER_RUN.fullmatch(ch))
    return sum(len(x) for x in KHMER_RUN.findall(text)) / letters if letters else 0.0


async def _to_khmer(r: Any, text: str, status: str, pipeline: str | None, context: dict[str, Any]) -> str | None:
    """Khmer display text: prepared texts for abstains, the model's own Khmer if native, else NLLB (Markdown-safe)."""
    from app.guard import engine
    from app.models.translator import translate_markdown

    if status == "ABSTAINED" and pipeline in ("RAG", "WEB"):
        return engine.texts(r, pipeline, "abstain")["KM"]
    if context.get("answerLanguage") == "Khmer":
        if _khmer_ratio(text) >= float(r.harness.get("language", {}).get("khmerNativeOutputMinRatio", 0.3)):
            return text
    return await translate_markdown(text, "EN", "KM")


def _clean(r: Any, raw: str, finish: str) -> str:
    """F1–F3: reasoning removed, normalized, fence closed, loop tail cut (the text Model Test grades)."""
    text = strip_reasoning(raw or "")
    text = _close_fence(normalize(text, r.guardrails))
    if finish == "LOOP_STOP" or detect_loop(text, r.harness["loopDetection"]):
        text = cut_loop(text, r.harness["loopDetection"])
    return text


async def finalize(req: dict[str, Any]) -> dict[str, Any]:
    if req.get("task") == "EVAL_CASE":
        return await _finalize_eval(req)
    return await _finalize(req)


async def _finalize_eval(req: dict[str, Any]) -> dict[str, Any]:
    """HARNESS.md §12.2 step 4: run the case's own finalize once (no retries), then grade the F1–F3 text."""
    from app.evals import graders
    from app.harness.prepare import variables
    from app.rules.loader import system_message

    r = rules()
    context = req.get("context") or {}
    inner_task = context.get("evalTask") or "MESSAGE"
    case_id = context.get("evalCaseId")
    case = next((c for s in r.suites.values() for c in s.cases if c.id == case_id), None)
    if case is None:
        from app.errors import ServiceError

        raise ServiceError("NOT_FOUND", "Unknown Model Test case.", 404)
    output = req.get("output") or {}
    user = {**(req.get("user") or {}), "guardProfile": "TEST", "outputLanguage": "EN"}
    max_attempts = int(r.harness["generation"]["jsonMaxAttempts"])
    res = await _finalize({**req, "task": inner_task, "user": user, "attempt": max_attempts})
    graded = _clean(r, output.get("content") or "", output.get("finishReason") or "STOP")
    mode = r.mode_for(inner_task, context.get("pipeline"))
    values = variables(user, inner_task, mode, context.get("answerLanguage") or "English")
    checks = graders.grade(
        r,
        case,
        graded,
        sources=context.get("sources") or [],
        instructions_text=system_message(r.system, mode, values, False),
        user_text=context.get("modelInput") or "",
        abstain_text=mode.abstain_text,
        task_input=context.get("taskInput") or case.raw.get("taskInput") or {},
        today=str(values["TODAY"]),
        weekday=str(values["WEEKDAY"]),
    )
    in_would = (context.get("inputGuard") or {}).get("wouldAction")
    out_would = (res.get("metrics") or {}).get("guardOutputAction")
    result = graders.result(case, graded, checks, graders.would_block(in_would, out_would), output.get("stats"))
    return {
        **res,
        "status": "COMPLETED",
        "content": graded,
        "errors": [],
        "repairMessages": [],
        "attemptsLeft": None,
        "evalResult": result,
    }


async def _finalize(req: dict[str, Any]) -> dict[str, Any]:
    r = rules()
    attempt = int(req.get("attempt") or 1)
    user = req.get("user") or {}
    context = req.get("context") or {}
    output = req.get("output") or {}
    finish = output.get("finishReason") or "STOP"
    guard_profile = user.get("guardProfile") or "STANDARD"
    max_attempts = int(r.harness["generation"]["jsonMaxAttempts"])

    text = _clean(r, output.get("content") or "", finish)  # F1–F3

    base: dict[str, Any] = {
        "originalContent": None,
        "translations": {},
        "data": None,
        "errors": [],
        "repairMessages": [],
        "evalResult": None,
        "guardEvents": [],
        "finishReason": finish,
        "attemptsLeft": None,
        "guard": {"action": "ALLOW", "categories": [], "profile": guard_profile, "wouldAction": None},
    }
    task = req.get("task") or "MESSAGE"
    if task == "TITLE":  # §11.1: never retried, never FAILED
        title = structured.clean_title(text) if text.strip() else None
        return {
            **base,
            "status": "COMPLETED",
            "content": title or "",
            "data": {"title": title},
            "grounding": None,
            "suggestions": [],
            "metrics": _metrics(None, None, "ALLOW", attempt),
        }
    if not text.strip():  # F4
        return {
            **base,
            "status": "EMPTY",
            "content": "",
            "grounding": None,
            "suggestions": [],
            "repairMessages": [
                {"role": "assistant", "content": ""},
                {"role": "user", "content": "Your answer was empty. Answer the question."},
            ],
            "attemptsLeft": max(0, max_attempts - attempt),
            "metrics": {
                "groundingLevel": None,
                "supportedRatio": None,
                "guardOutputAction": "ALLOW",
                "jsonAttempts": attempt,
            },
        }

    if task != "MESSAGE" and task != "LEARN_STEP":  # F5 structured output (§9.1)
        mode = r.mode_for(task)
        ti = {**(context.get("taskInput") or {}), "finalAttempt": attempt >= max_attempts}
        data, errs = structured.validate(r, mode.schema or "", text, ti)
        if errs:
            return {
                **base,
                "status": "SCHEMA_INVALID",
                "content": text,
                "errors": errs,
                "repairMessages": structured.repair_messages(text, errs),
                "attemptsLeft": max(0, max_attempts - attempt),
                "grounding": None,
                "suggestions": [],
                "metrics": _metrics(None, None, "ALLOW", attempt),
            }
        return {
            **base,
            "status": "COMPLETED",
            "content": text,
            "data": data,
            "grounding": None,
            "suggestions": [],
            "metrics": _metrics(None, None, "ALLOW", attempt),
        }

    pipeline = context.get("pipeline")
    output_language = context.get("outputLanguage") or user.get("outputLanguage") or "EN"  # per-turn choice

    # F6 output guardrails + F7 leak check (GUARDRAILS.md §5.3–5.4)
    from app.guard import engine
    from app.harness.prepare import variables
    from app.rules.loader import system_message

    mode = r.mode_for(task, pipeline)
    values = variables(user, task, mode, context.get("answerLanguage") or "English")
    secret = system_message(r.system, mode, values, False)
    out_guard = await engine.check_output(
        r,
        text,
        english=None,
        question=context.get("modelInput") or "",
        profile=guard_profile,
        instructions_text=secret,
        user_text=context.get("modelInput") or "",
        abstain_text=mode.abstain_text,
    )
    base["guardEvents"] = out_guard.events
    in_guard = context.get("inputGuard") or {}
    base["guard"] = {  # GuardSummary: the output decision when it acted, else the input one (e.g. SAFE_COMPLETE)
        "action": out_guard.action if out_guard.action != "ALLOW" else in_guard.get("action", "ALLOW"),
        "categories": out_guard.categories or in_guard.get("categories", []),
        "profile": guard_profile,
        "wouldAction": out_guard.would_action or in_guard.get("wouldAction"),
    }
    if out_guard.action in ("REPLACE", "SUPPORT"):
        key = engine.refusal_key(r, out_guard.action, out_guard.categories, out_guard.rule)
        fixed = engine.localized(engine.texts(r, key), task, output_language)
        return {
            **base,
            **fixed,
            "status": "SUPPORT" if out_guard.action == "SUPPORT" else "BLOCKED",
            "grounding": None,
            "suggestions": [],
            "metrics": {
                "groundingLevel": None,
                "supportedRatio": None,
                "guardOutputAction": out_guard.action,
                "jsonAttempts": attempt,
            },
        }

    # F8 Markdown policy: images, HTML, links only to this turn's source URLs, length
    from app.guard import markdown_policy

    source_urls = [str(x.get("url")) for x in context.get("sources") or [] if x.get("url")]
    text, removed_urls = markdown_policy.apply(text, source_urls, r.guardrails.get("output") or {})
    status = "COMPLETED"
    has_specific = False
    if pipeline == "CHAT":  # F11 (CHAT)
        has_specific = any(p.search(text) for p in r.patterns.get("grounding.specificFacts", []))
    grounding: dict[str, Any] = {
        "level": "NOT_APPLICABLE",
        "supportedRatio": 1.0,
        "sentences": [],
        "removedUrls": removed_urls,
        "removedCitations": 0,
        "hasSpecificFacts": has_specific,
    }
    extra_suggestions: list[dict[str, Any]] = []
    if pipeline in ("RAG", "WEB") and task == "MESSAGE":
        from app.harness import grounding as gv

        gcfg = r.harness["grounding"]
        abstain_text = r.mode_for(task, pipeline).abstain_text
        sources = context.get("sources") or []
        if gv.is_abstain(text, abstain_text, r.guardrails.get("abstain_markers") or []):  # F10
            status = "ABSTAINED"
            grounding = {**grounding, "level": "ABSTAINED", "supportedRatio": 0.0}
            if pipeline == "RAG":
                extra_suggestions.append(suggestion("UPLOAD_DOCUMENT"))
        else:  # F9 + F11
            from app.rag.retrieval import chunk_embeddings

            ids = [str(x["chunkId"]) for x in sources if x.get("chunkId")]
            if any(i.startswith("fx:") for i in ids):
                from app.evals.fixtures import embeddings as fixture_embeddings

                embs = await fixture_embeddings(ids)
            else:
                embs = await chunk_embeddings(ids)
            text, report = await gv.verify(text, sources, embs, gcfg, abstain_text)
            report["removedUrls"] = removed_urls
            grounding = report
            if grounding["level"] == "UNGROUNDED":
                policy = (gcfg.get("onUngrounded") or {}).get(guard_profile, "WARN")
                if policy == "REPLACE":
                    text = engine.texts(r, "UNGROUNDED_REPLACED", "abstain")["EN"]
                    grounding = {**grounding, "sentences": []}
            text = text.strip()
            gv.set_offsets(text, grounding)

    if status == "COMPLETED" and task == "MESSAGE":  # F12 tool enforcement
        from app.harness.tools import enforce_calculator

        text = enforce_calculator(text, context.get("tools") or [])
    if status == "COMPLETED":  # §5.5 SAFE_COMPLETE disclaimers (input categories + output categories)
        keys = list((context.get("inputGuard") or {}).get("disclaimers") or []) + out_guard.disclaimers
        if keys and not engine.profile_cfg(r, guard_profile).get("recordOnly"):
            text = engine.ensure_disclaimers(r, text, keys, "EN")

    if task == "LEARN_STEP" and status == "COMPLETED":  # §11.3 required headings
        text = structured.fix_headings(text)
        missing = structured.missing_headings(text)
        if missing:
            return {
                **base,
                "status": "SCHEMA_INVALID",
                "content": text,
                "errors": [f"$: missing heading '{h}'" for h in missing],
                "repairMessages": structured.repair_messages(text, missing, lesson=True),
                "attemptsLeft": max(0, max_attempts - attempt),
                "grounding": None,
                "suggestions": [],
                "metrics": _metrics(None, None, out_guard.action, attempt),
            }

    original_content: str | None = None  # F13 language (MESSAGE only)
    translations: dict[str, str] = {}
    if task == "MESSAGE" and output_language in ("KM", "BOTH"):
        km = await _to_khmer(r, text.strip(), status, pipeline, context)
        if km is not None and output_language == "KM":
            original_content, text = text.strip(), km
        elif km is not None:
            translations = {"KM": km}
    base["originalContent"], base["translations"] = original_content, translations

    suggestions = list((context.get("routing") or {}).get("suggestions") or []) + extra_suggestions  # F14
    provider = req.get("provider") or {}
    from app.api.system import features
    from app.config import get_settings

    host_ok = provider.get("kind") != "HOST" and features(get_settings())["hostChat"]
    if host_ok and (finish == "LOOP_STOP" or grounding.get("level") == "UNGROUNDED"):
        suggestions.append(suggestion("SWITCH_TO_HOST_MODEL"))
    seen: set[str] = set()
    merged = []
    for s in suggestions:
        if s["type"] not in seen:
            seen.add(s["type"])
            merged.append(s)

    return {
        **base,
        "status": status,
        "content": text.strip(),
        "grounding": grounding,
        "suggestions": merged,
        "metrics": {
            "groundingLevel": grounding["level"],
            "supportedRatio": grounding["supportedRatio"],
            "guardOutputAction": out_guard.would_action or out_guard.action,
            "jsonAttempts": attempt,
        },
    }
