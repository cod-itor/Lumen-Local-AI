"""Optional guard classifiers (GUARDRAILS.md §5.6). Both are off unless the owner enables them in .env.

- Llama Guard 3 1B through the host Ollama (`GUARD_CONTENT_CLASSIFIER=true`, model pulled with `ollama pull`).
- Prompt Guard 2 through Hugging Face transformers (`GUARD_INJECTION_CLASSIFIER=true`); transformers/torch are not a
  dependency of the local demo, so without them the score is simply unavailable (regex patterns still apply).
A slow or missing classifier never blocks a user: timeouts and errors mean "no extra categories".
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings
from app.rules.models import Rules

log = logging.getLogger(__name__)
_prompt_guard: Any = None


async def llama_guard(r: Rules, question: str, answer: str | None) -> set[str]:
    s = get_settings()
    if not s.guard_content_classifier:
        return set()
    cfg = r.guardrails["classifiers"]["content"]
    messages = [{"role": "user", "content": question}]
    if answer is not None:
        messages.append({"role": "assistant", "content": answer})
    body = {
        "model": s.guard_content_model or cfg["ollamaModel"],
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0, "num_predict": 10},
    }
    try:
        async with httpx.AsyncClient(timeout=float(cfg.get("timeoutSeconds", 8))) as client:
            resp = await client.post(f"{s.ollama_host}/api/chat", json=body)
            resp.raise_for_status()
            out = (resp.json().get("message") or {}).get("content") or ""
    except (httpx.HTTPError, ValueError) as e:
        log.warning("llama guard unavailable (%s): allowing", type(e).__name__)
        return set()
    lines = [x.strip() for x in out.strip().splitlines() if x.strip()]
    if not lines or lines[0].lower() != "unsafe":
        return set()
    codes = {c.strip().upper() for c in (lines[1] if len(lines) > 1 else "").split(",") if c.strip()}
    return {name for name, c in r.guardrails["categories"].items() if c.get("code") in codes}


async def prompt_guard_score(text: str) -> float | None:
    s = get_settings()
    if not s.guard_injection_classifier:
        return None
    global _prompt_guard
    try:
        if _prompt_guard is None:
            from transformers import pipeline  # type: ignore[import-not-found]

            _prompt_guard = pipeline("text-classification", model=s.prompt_guard_model, top_k=None)
        scores = _prompt_guard(text[:2000])[0]
    except Exception as e:  # noqa: BLE001 — optional model; any failure means "no score"
        log.warning("prompt guard unavailable (%s)", type(e).__name__)
        return None
    return max((float(x["score"]) for x in scores if str(x["label"]).upper() in ("MALICIOUS", "LABEL_1")), default=0.0)
