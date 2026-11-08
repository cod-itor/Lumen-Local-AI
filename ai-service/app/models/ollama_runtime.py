"""Ollama chat runtime for SERVER generation (AI_SERVICE.md §6.1, §6.3)."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator
from typing import Any

from ollama import AsyncClient, ResponseError

from app.config import get_settings
from app.harness.budget import est_tokens
from app.harness.loops import LoopWatcher
from app.harness.reasoning import StreamReasoningFilter
from app.state import rules

log = logging.getLogger("lumen.ollama")

Event = tuple[str, dict[str, Any]]


class GenerationSlots:
    """FIFO-ish limit on concurrent server generations, with queue positions for `queued` events."""

    def __init__(self, size: int) -> None:
        self.size = size
        self.sem = asyncio.Semaphore(size)
        self.waiting: list[str] = []
        self.active = 0

    def position(self, turn_id: str) -> int:
        return self.waiting.index(turn_id) + 1 if turn_id in self.waiting else 0


_slots: GenerationSlots | None = None
_client: AsyncClient | None = None


def slots() -> GenerationSlots:
    global _slots
    size = int(rules().harness["generation"]["serverParallelTurns"])
    if _slots is None or _slots.size != size:
        _slots = GenerationSlots(size)
    return _slots


def client() -> AsyncClient:
    global _client
    if _client is None:
        _client = AsyncClient(host=get_settings().ollama_host)
    return _client


def _options(params: dict[str, Any]) -> dict[str, Any]:
    opts = {
        "temperature": params["temperature"],
        "top_p": params["topP"],
        "num_predict": params["maxTokens"],
        "num_ctx": params["numCtx"],
        "repeat_penalty": params["repeatPenalty"],
    }
    if params.get("minP") is not None:
        opts["min_p"] = params["minP"]
    if params.get("stop"):
        opts["stop"] = params["stop"]
    if params.get("seed") is not None:
        opts["seed"] = params["seed"]
    return opts


async def warm_up() -> None:
    s = get_settings()
    try:
        await client().chat(
            model=s.ollama_chat_model,
            messages=[{"role": "user", "content": "hi"}],
            options={"num_predict": 1},
            keep_alive=s.ollama_keep_alive,
        )
        log.info("Warmed up %s", s.ollama_chat_model)
    except Exception as e:  # noqa: BLE001 — warm-up is best effort
        log.warning("Warm-up skipped: %s", e)


async def generate(req: dict[str, Any]) -> AsyncIterator[Event]:
    s = get_settings()
    params = req["params"]
    profile = req.get("modelProfile") or {}
    guard = req.get("clientGuard") or {}
    stops: list[str] = list(params.get("stop") or [])
    guard_patterns = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in guard.get("stopPatterns") or []]
    max_chars = int(guard.get("maxOutputChars") or 100_000)
    loop = LoopWatcher(guard.get("loop") or rules().harness["loopDetection"])
    hold = max((len(x) for x in stops), default=1) - 1

    sl = slots()
    turn_id = str(req.get("turnId"))
    sl.waiting.append(turn_id)
    try:
        while True:
            if sl.active < sl.size and sl.waiting and sl.waiting[0] == turn_id:
                await sl.sem.acquire()
                break
            yield "queued", {"position": sl.position(turn_id)}
            for _ in range(100):  # wake every 0.1 s, report every 10 s
                await asyncio.sleep(0.1)
                if sl.active < sl.size and sl.waiting and sl.waiting[0] == turn_id:
                    break
    finally:
        if turn_id in sl.waiting:
            sl.waiting.remove(turn_id)
    sl.active += 1

    start = time.monotonic()
    ttft: float | None = None
    visible = ""
    emitted = 0
    finish = "STOP"
    last: Any = None
    filt = StreamReasoningFilter()
    try:
        kwargs: dict[str, Any] = {}
        if profile.get("disableThinking") == "OLLAMA_THINK_FALSE":
            kwargs["think"] = False
        fmt = req.get("outputSchema") if profile.get("jsonSchema") else None
        stream = await client().chat(
            model=req["target"]["model"],
            messages=req["messages"],
            stream=True,
            options=_options(params),
            format=fmt,
            keep_alive=s.ollama_keep_alive,
            **kwargs,
        )
        stopped = False
        async for chunk in stream:
            last = chunk
            piece = filt.feed(chunk.message.content or "") if chunk.message else ""
            if chunk.done:
                piece += filt.finish()
            if piece:
                if ttft is None:
                    ttft = time.monotonic() - start
                visible += piece
            # stop strings (some runtimes ignore them)
            for st in stops:
                i = visible.find(st)
                if i != -1:
                    visible, finish, stopped = visible[:i], "STOP", True
            if not stopped and any(p.search(visible) for p in guard_patterns):
                finish, stopped = "GUARD_STOP", True
            if not stopped and loop.feed(visible):
                finish, stopped = "LOOP_STOP", True
            if not stopped and len(visible) > max_chars:
                visible, finish, stopped = visible[:max_chars], "LENGTH", True
            safe_end = len(visible) if (stopped or chunk.done) else max(emitted, len(visible) - hold)
            if finish != "GUARD_STOP" and safe_end > emitted:
                yield "token", {"text": visible[emitted:safe_end]}
                emitted = safe_end
            if stopped:
                break
            if chunk.done:
                if chunk.done_reason == "length":
                    finish = "LENGTH"
                break
    except ResponseError as e:
        log.warning("Ollama error: %s", e)
        retry = e.status_code >= 500 if e.status_code else True
        yield "error", {"code": "MODEL_ERROR", "message": "The host model failed to answer.", "retryable": retry}
        return
    except (ConnectionError, OSError) as e:
        log.warning("Ollama unreachable: %s", e)
        yield "error", {"code": "MODEL_UNAVAILABLE", "message": "The host model is not reachable.", "retryable": True}
        return
    finally:
        sl.active -= 1
        sl.sem.release()

    total = time.monotonic() - start
    out_tokens = getattr(last, "eval_count", None) if last is not None and last.done else None
    eval_ns = getattr(last, "eval_duration", None) if last is not None and last.done else None
    prompt_tokens = getattr(last, "prompt_eval_count", None) if last is not None and last.done else None
    if out_tokens is None:
        out_tokens = est_tokens(visible, rules().harness, messages=0)
    if eval_ns:
        tps = out_tokens / (eval_ns / 1e9)
    elif ttft is not None and total - ttft > 0:
        tps = out_tokens / (total - ttft)
    else:
        tps = None
    yield (
        "done",
        {
            "content": visible,
            "finishReason": finish,
            "stats": {
                "ttftMs": round(ttft * 1000) if ttft is not None else None,
                "tokensPerSec": round(tps, 1) if tps else None,
                "outputTokens": out_tokens,
                "promptTokens": prompt_tokens,
                "totalMs": round(total * 1000),
                "model": req["target"]["model"],
            },
        },
    )
