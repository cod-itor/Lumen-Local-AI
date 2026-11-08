"""Streaming speech-to-text (AI_SERVICE.md §11): faster-whisper + Silero VAD v6 (the ONNX model bundled with
faster-whisper, run frame by frame with its recurrent state, so no torch is needed).

One `Utterances` object per connection: feed 16 kHz int16 PCM, get `partial` / `final` events.
"""

from __future__ import annotations

import logging
import re
from collections import deque
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import numpy as np

from app.config import get_settings

log = logging.getLogger(__name__)

SR = 16_000
FRAME = 512  # Silero VAD needs exactly 512 samples at 16 kHz
CONTEXT = 64
THRESHOLD = 0.5
NEG_THRESHOLD = 0.35  # leave speech only below this (hysteresis, as Silero's VADIterator)
MIN_SILENCE_MS = 800
SPEECH_PAD_MS = 100
PARTIAL_EVERY_S = 1.0
MAX_UTTERANCE_S = 60
AUTO_DETECT_S = 3.0
KM_SWITCH_PROB = 0.5
CPU_THREADS = 6
_KM_GAP = re.compile(r"(?<=[\u1780-\u17ff])[ \u200b]+(?=[\u1780-\u17ff])")  # written Khmer has no word spaces


class StreamingVad:
    """Silero VAD v6 over consecutive 512-sample frames (keeps h/c state and the 64-sample context)."""

    def __init__(self) -> None:
        self.session = _vad_session()
        self.reset()

    def reset(self) -> None:
        self.h = np.zeros((1, 1, 128), dtype="float32")
        self.c = np.zeros((1, 1, 128), dtype="float32")
        self.ctx = np.zeros(CONTEXT, dtype="float32")

    def prob(self, frame: np.ndarray) -> float:
        x = np.concatenate([self.ctx, frame])[None, :].astype("float32")
        out, self.h, self.c = self.session.run(None, {"input": x, "h": self.h, "c": self.c})
        self.ctx = frame[-CONTEXT:]
        return float(np.asarray(out).reshape(-1)[0])


@lru_cache(maxsize=1)
def _vad_session() -> Any:
    from faster_whisper.vad import get_vad_model

    return get_vad_model().session


def en_model_dir() -> Any:
    s = get_settings()
    return s.models_dir / f"faster-whisper-{s.whisper_en_model}"


def available() -> bool:
    return (en_model_dir() / "model.bin").is_file()


def khmer_available() -> bool:
    return (get_settings().whisper_km_model_dir / "model.bin").is_file()


@lru_cache(maxsize=2)
def _model(kind: str) -> Any:
    from faster_whisper import WhisperModel

    path = en_model_dir() if kind == "EN" else get_settings().whisper_km_model_dir
    log.info("loading whisper %s from %s", kind, path)
    return WhisperModel(str(path), device="cpu", compute_type="int8", cpu_threads=CPU_THREADS)


def transcribe(audio: np.ndarray, kind: str, language: str | None, beam_size: int) -> tuple[str, str]:
    """Blocking; returns (text, language)."""
    segments, info = _model(kind).transcribe(
        audio,
        language=language,
        beam_size=beam_size,
        vad_filter=False,
        condition_on_previous_text=False,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    lang = info.language or (language or "en")
    return (_KM_GAP.sub("", text) if lang == "km" else text), lang


def detect(audio: np.ndarray) -> tuple[str, float]:
    """Whisper language detection with the English small model → (language, probability)."""
    lang, prob, _ = _model("EN").detect_language(audio)
    return lang, float(prob)


@dataclass
class Utterances:
    """Per-connection VAD + utterance buffer. `feed` returns actions for the caller to run."""

    lang: str  # EN | KM | AUTO
    vad: StreamingVad = field(default_factory=StreamingVad)
    pending: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype="float32"))
    speech: list[np.ndarray] = field(default_factory=list)
    preroll: deque = field(default_factory=lambda: deque(maxlen=max(1, SPEECH_PAD_MS * SR // 1000 // FRAME + 1)))
    speaking: bool = False
    silence: int = 0
    since_partial: int = 0
    detected: str | None = None  # AUTO: "en" or "km" after detection

    def kind(self) -> str:
        if self.lang == "KM" or self.detected == "km":
            return "KM"
        return "EN"

    def language(self) -> str | None:
        if self.lang == "EN":
            return "en"
        if self.kind() == "KM":
            return "km"
        return self.detected  # None until AUTO detection ran

    def samples(self) -> int:
        return sum(len(x) for x in self.speech)

    def audio(self) -> np.ndarray:
        return np.concatenate(self.speech) if self.speech else np.zeros(0, dtype="float32")

    def take(self) -> np.ndarray:
        a = self.audio()
        self.speech.clear()
        self.speaking = False
        self.silence = 0
        self.since_partial = 0
        return a

    def feed(self, pcm: bytes) -> list[str]:
        """Add int16 LE mono PCM; returns actions: "partial" (transcribe the buffer) or "final" (utterance ended)."""
        x = np.frombuffer(pcm[: len(pcm) - len(pcm) % 2], dtype="<i2").astype("float32") / 32768.0
        self.pending = np.concatenate([self.pending, x])
        actions: list[str] = []
        min_silence = MIN_SILENCE_MS * SR // 1000 // FRAME
        while len(self.pending) >= FRAME:
            frame, self.pending = self.pending[:FRAME], self.pending[FRAME:]
            p = self.vad.prob(frame)
            if not self.speaking:
                if p >= THRESHOLD:
                    self.speaking = True
                    self.speech = [*self.preroll, frame]
                    self.preroll.clear()
                    self.silence = 0
                else:
                    self.preroll.append(frame)
                continue
            self.speech.append(frame)
            self.since_partial += FRAME
            self.silence = self.silence + 1 if p < NEG_THRESHOLD else 0
            if self.silence >= min_silence or self.samples() >= MAX_UTTERANCE_S * SR:
                actions.append("final")
            elif self.since_partial >= PARTIAL_EVERY_S * SR:
                self.since_partial = 0
                actions.append("partial")
        return actions
