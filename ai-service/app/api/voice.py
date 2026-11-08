"""WS /voice/stream (AI_SERVICE.md §11.2, protocol API_CONTRACT §6.8) and POST /voice/tts (§11.3, off)."""

from __future__ import annotations

import asyncio
import hmac
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Body, Depends, WebSocket, WebSocketDisconnect

from app.api.system import features
from app.auth import require_internal_token
from app.config import get_settings
from app.errors import ServiceError
from app.voice import stt

log = logging.getLogger(__name__)
router = APIRouter()

MAX_CONNECTION_S = 300
SLOTS = asyncio.Semaphore(2)  # at most 2 connections transcribing at once service-wide


def _authorized(ws: WebSocket) -> bool:
    got = ws.headers.get("x-internal-token") or ""
    expected = get_settings().internal_token
    return bool(got) and hmac.compare_digest(got.encode(), expected.encode())


async def _send(ws: WebSocket, msg: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(msg, ensure_ascii=False))


@router.websocket("/voice/stream")
async def voice_stream(ws: WebSocket) -> None:
    if not _authorized(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    if not features(get_settings())["voice"]:
        await _send(ws, {"type": "error", "code": "FEATURE_UNAVAILABLE", "message": "Voice input is not installed."})
        await ws.close(code=1000)
        return
    if SLOTS.locked():
        await _send(ws, {"type": "error", "code": "VOICE_BUSY", "message": "Voice is busy, try again in a moment."})
        await ws.close(code=1000)
        return
    async with SLOTS:
        try:
            await asyncio.wait_for(_session(ws), timeout=MAX_CONNECTION_S)
        except TimeoutError:
            await ws.close(code=1008, reason="Time limit")
        except WebSocketDisconnect:
            pass
        except Exception:
            log.exception("voice stream failed")
            try:
                await _send(ws, {"type": "error", "code": "INTERNAL_ERROR", "message": "Voice input failed."})
                await ws.close(code=1011)
            except Exception:  # noqa: BLE001 — the socket may already be gone
                log.debug("voice: close after error failed")


async def _session(ws: WebSocket) -> None:
    start = await ws.receive_text()
    msg = json.loads(start)
    if msg.get("type") != "start" or int(msg.get("sampleRate") or 16000) != stt.SR:
        await _send(ws, {"type": "error", "code": "INTERNAL_ERROR", "message": "Send start with sampleRate 16000."})
        await ws.close(code=1008)
        return
    lang = str(msg.get("lang") or "AUTO").upper()
    if lang not in ("EN", "KM", "AUTO"):
        lang = "AUTO"
    if lang == "KM" and not stt.khmer_available():
        await _send(ws, {"type": "error", "code": "FEATURE_UNAVAILABLE", "message": "Khmer voice is not installed."})
        await ws.close(code=1000)
        return
    u = await asyncio.to_thread(stt.Utterances, lang)
    await asyncio.to_thread(stt._model, u.kind())  # load before "ready" so the first partial is quick
    await _send(ws, {"type": "ready"})

    lock = asyncio.Lock()  # one transcription at a time per connection
    partial_task: asyncio.Task | None = None

    async def maybe_detect() -> None:
        if u.lang != "AUTO" or u.detected is not None:
            return
        if u.samples() < stt.AUTO_DETECT_S * stt.SR:
            return
        language, prob = await asyncio.to_thread(stt.detect, u.audio()[: int(stt.AUTO_DETECT_S * stt.SR)])
        u.detected = "km" if language == "km" and prob >= stt.KM_SWITCH_PROB and stt.khmer_available() else "en"

    async def partial() -> None:
        async with lock:
            await maybe_detect()
            audio = u.audio()
            if len(audio) < stt.SR // 2:
                return
            text, _ = await asyncio.to_thread(stt.transcribe, audio, u.kind(), u.language(), 1)
            if text and u.speaking:
                await _send(ws, {"type": "partial", "text": text})

    async def final() -> None:
        nonlocal partial_task
        if partial_task and not partial_task.done():
            partial_task.cancel()
        async with lock:
            if u.lang == "AUTO" and u.detected is None and u.samples() >= stt.SR:
                language, prob = await asyncio.to_thread(stt.detect, u.audio())
                km = language == "km" and prob >= stt.KM_SWITCH_PROB and stt.khmer_available()
                u.detected = "km" if km else "en"
            audio = u.take()
            if len(audio) < stt.SR // 4:
                return
            t0 = time.monotonic()
            text, language = await asyncio.to_thread(stt.transcribe, audio, u.kind(), u.language(), 5)
            log.info("voice final %.1fs audio in %.1fs (%s)", len(audio) / stt.SR, time.monotonic() - t0, language)
            if text:
                await _send(ws, {"type": "final", "text": text, "language": language})

    while True:
        m = await ws.receive()
        if m.get("type") == "websocket.disconnect":
            raise WebSocketDisconnect(m.get("code") or 1000)
        if m.get("bytes") is not None:
            for action in u.feed(m["bytes"]):
                if action == "final":
                    await final()
                elif partial_task is None or partial_task.done():
                    partial_task = asyncio.create_task(partial())
        elif m.get("text") is not None:
            if json.loads(m["text"]).get("type") == "stop":
                if u.speaking or u.speech:
                    await final()
                await ws.close(code=1000)
                return


@router.post("/voice/tts", dependencies=[Depends(require_internal_token)])
async def voice_tts(body: dict[str, Any] = Body(...)) -> None:  # noqa: B008
    """Read aloud is off in this build (Piper is GPL-3.0, MMS-TTS Khmer is CC-BY-NC); AI_SERVICE.md §11.3."""
    raise ServiceError("FEATURE_UNAVAILABLE", "Read aloud is not installed on this server.", 503)
