"""Finalize pipeline F1–F15 (HARNESS.md §9)."""

from __future__ import annotations

from typing import Any

from app.harness.loops import cut_loop, detect_loop
from app.harness.normalize import normalize
from app.harness.reasoning import strip_reasoning
from app.harness.router import suggestion
from app.state import rules


def _close_fence(text: str) -> str:
    return text + "\n```" if text.count("```") % 2 == 1 else text


async def finalize(req: dict[str, Any]) -> dict[str, Any]:
    r = rules()
    attempt = int(req.get("attempt") or 1)
    user = req.get("user") or {}
    context = req.get("context") or {}
    output = req.get("output") or {}
    finish = output.get("finishReason") or "STOP"
    guard_profile = user.get("guardProfile") or "STANDARD"
    loop_cfg = r.harness["loopDetection"]
    max_attempts = int(r.harness["generation"]["jsonMaxAttempts"])

    text = strip_reasoning(output.get("content") or "")  # F1
    text = _close_fence(normalize(text, r.guardrails))  # F2 (+ neutralize fake control tokens/source headers)
    if finish == "LOOP_STOP" or detect_loop(text, loop_cfg):  # F3
        text = cut_loop(text, loop_cfg)

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

    pipeline = context.get("pipeline")
    task = req.get("task") or "MESSAGE"
    output_language = user.get("outputLanguage") or "EN"

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

            embs = await chunk_embeddings([str(x["chunkId"]) for x in sources if x.get("chunkId")])
            text, report = await gv.verify(text, sources, embs, gcfg, abstain_text)
            report["removedUrls"] = removed_urls
            grounding = report
            if grounding["level"] == "UNGROUNDED":
                policy = (gcfg.get("onUngrounded") or {}).get(guard_profile, "WARN")
                if policy == "REPLACE":
                    text = f"{abstain_text} The answer could not be checked against your sources."
                    grounding = {**grounding, "sentences": []}
            text = text.strip()
            gv.set_offsets(text, grounding)

    if status == "COMPLETED":  # §5.5 SAFE_COMPLETE disclaimers (input categories + output categories)
        keys = list((context.get("inputGuard") or {}).get("disclaimers") or []) + out_guard.disclaimers
        if keys and not engine.profile_cfg(r, guard_profile).get("recordOnly"):
            text = engine.ensure_disclaimers(r, text, keys, "EN")

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
