"""Voice (AI_SERVICE.md §11): streaming VAD bookkeeping and the WebSocket gate."""

import numpy as np
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.voice import stt


def pcm(x: np.ndarray) -> bytes:
    return (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()


def test_silence_is_not_speech():
    u = stt.Utterances("EN")
    assert u.feed(pcm(np.zeros(stt.SR * 2))) == []
    assert not u.speaking and u.samples() == 0


def test_odd_chunks_are_buffered():
    u = stt.Utterances("EN")
    data = pcm(np.zeros(stt.FRAME * 3))
    for i in range(0, len(data), 333):  # not frame aligned, odd byte counts
        u.feed(data[i : i + 333])
    assert len(u.pending) < stt.FRAME


def test_vad_state_is_kept_between_frames():
    v = stt.StreamingVad()
    f = np.zeros(stt.FRAME, dtype="float32")
    v.prob(f)
    h = v.h.copy()
    v.prob(f)
    assert v.h.shape == h.shape == (1, 1, 128)


def test_language_choice():
    assert stt.Utterances("EN").language() == "en"
    u = stt.Utterances("AUTO")
    assert u.language() is None and u.kind() == "EN"
    u.detected = "km"
    assert u.kind() == "KM" and u.language() == "km"


def test_stream_needs_internal_token():
    from app.main import app

    with TestClient(app) as c, pytest.raises(WebSocketDisconnect) as e, c.websocket_connect("/voice/stream") as ws:
        ws.receive_text()
    assert e.value.code == 1008


def test_khmer_word_spaces_removed():
    assert stt._KM_GAP.sub("", "សួស្តី ពិភពលោក hello world") == "សួស្តីពិភពលោក hello world"
