"""Khmer ↔ English translation (AI_SERVICE.md §9, HARNESS.md §6.3).

Primary: NLLB-200 distilled 600M as a CTranslate2 int8 model + its SentencePiece tokenizer (no torch/transformers).
Fallback: the `translate` mode with the host chat model. Without either, text passes through unchanged and the caller
records that no pivot happened. Model files live in TRANSLATION_MODEL_DIR (`model.bin`, `sentencepiece.bpe.model`).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from collections import OrderedDict
from functools import lru_cache
from typing import Any

from app.config import get_settings

log = logging.getLogger(__name__)

CODES = {"EN": "eng_Latn", "KM": "khm_Khmr"}
BATCH = 16
MAX_PIECES = 200
_CACHE: OrderedDict[str, str] = OrderedDict()
_CACHE_SIZE = 2000
_LOCK = asyncio.Lock()
_KM_GAP = re.compile(r"(?<=[\u1780-\u17ff])[ \u200b]+(?=[\u1780-\u17ff])")


class _Nllb:
    def __init__(self) -> None:
        import ctranslate2  # type: ignore[import-not-found]
        import sentencepiece as spm  # type: ignore[import-not-found]

        d = get_settings().translation_model_dir
        self.sp = spm.SentencePieceProcessor(model_file=str(d / "sentencepiece.bpe.model"))
        self.tr = ctranslate2.Translator(str(d), device="cpu", compute_type="int8")

    def translate(self, sentences: list[str], src: str, tgt: str) -> list[str]:
        toks = [[CODES[src], *self.sp.encode(s, out_type=str), "</s>"] for s in sentences]
        res = self.tr.translate_batch(
            toks,
            target_prefix=[[CODES[tgt]]] * len(toks),
            beam_size=4,
            max_decoding_length=min(256, 2 * max(len(t) for t in toks) + 16),
            repetition_penalty=1.2,
            no_repeat_ngram_size=4,
        )
        out = [self.sp.decode(r.hypotheses[0][1:]) for r in res]
        # NLLB writes a space between Khmer words; written Khmer has none.
        return [_KM_GAP.sub("", t) for t in out] if tgt == "KM" else out


@lru_cache(maxsize=1)
def _engine() -> _Nllb | None:
    s = get_settings()
    if not (s.translation_model_dir / "model.bin").is_file():
        return None
    try:
        return _Nllb()
    except Exception as e:  # noqa: BLE001 — optional model: any load failure means "not available"
        log.warning("translation model unavailable: %s", e)
        return None


def available() -> bool:
    return (get_settings().translation_model_dir / "model.bin").is_file()


async def _host_fallback(text: str, src: str, tgt: str) -> str | None:
    """The `translate` mode on the host chat model (only when the host has one)."""
    from app.api.system import features
    from app.models.ollama_runtime import client
    from app.rules.loader import system_message
    from app.state import rules

    s = get_settings()
    if not features(s)["hostChat"]:
        return None
    r = rules()
    mode = r.modes.get("translate")
    if not mode:
        return None
    names = {"EN": "English", "KM": "Khmer"}
    values = {"SOURCE_LANGUAGE": names[src], "TARGET_LANGUAGE": names[tgt], "APP_NAME": s.app_name}
    try:
        resp = await client().chat(
            model=s.ollama_chat_model,
            messages=[
                {"role": "system", "content": system_message(r.system, mode, {**_defaults(), **values}, False)},
                {"role": "user", "content": f"TEXT:\n{text}"},
            ],
            options={"temperature": mode.temperature, "num_predict": mode.max_output_tokens, "num_ctx": 4096},
            keep_alive=s.ollama_keep_alive,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("host translation failed: %s", e)
        return None
    return (resp.get("message") or {}).get("content", "").strip() or None


def _defaults() -> dict[str, Any]:
    return {
        "TODAY": "",
        "WEEKDAY": "",
        "TIMEZONE": "",
        "ANSWER_LANGUAGE": "English",
        "MAX_WORDS": 600,
        "COUNT": 5,
        "EMERGENCY_LINE": "",
    }


def _split_long(sentence: str, sp: Any) -> list[str]:
    if sp is None or len(sp.encode(sentence)) <= MAX_PIECES:
        return [sentence]
    parts = re.split(r"(?<=[,;،])\s+", sentence)
    return [p for p in parts if p.strip()] or [sentence]


async def translate_sentences(sentences: list[str], src: str, tgt: str) -> list[str] | None:
    """Plain sentences (no Markdown). None if no translator is available."""
    if not sentences:
        return []
    eng = _engine()
    if eng is None:
        out: list[str] = []
        for s in sentences:
            t = await _host_fallback(s, src, tgt)
            if t is None:
                return None
            out.append(t)
        return out
    results: list[str] = []
    todo: list[tuple[int, list[str]]] = []
    for i, s in enumerate(sentences):
        key = hashlib.sha256(s.encode()).hexdigest() + src + tgt
        if key in _CACHE:
            _CACHE.move_to_end(key)
            results.append(_CACHE[key])
        else:
            results.append("")
            todo.append((i, _split_long(s, eng.sp)))
    flat = [p for _, parts in todo for p in parts]
    translated: list[str] = []
    async with _LOCK:  # CTranslate2 on CPU: one batch at a time
        for j in range(0, len(flat), BATCH):
            translated += await asyncio.to_thread(eng.translate, flat[j : j + BATCH], src, tgt)
    k = 0
    for i, parts in todo:
        joined = " ".join(translated[k : k + len(parts)])
        k += len(parts)
        results[i] = joined
        key = hashlib.sha256(sentences[i].encode()).hexdigest() + src + tgt
        _CACHE[key] = joined
        if len(_CACHE) > _CACHE_SIZE:
            _CACHE.popitem(last=False)
    return results


# ---------------------------------------------------------------- Markdown-safe translation (§6.3)

_FENCE = re.compile(r"^```")
_PREFIX = re.compile(r"^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)*)")
_PROTECT = re.compile(r"`[^`\n]+`|https?://\S+|www\.\S+")
_CITE = re.compile(r"\s*\[(\d+(?:\s*,\s*\d+)*)\]")
_SENT = re.compile(r"(?<=[.!?។៕])\s+")
_END = re.compile(r"([.!?។៕:;]+)\s*$")


async def translate_markdown(text: str, src: str, tgt: str) -> str | None:
    """Translate Markdown keeping structure, code, URLs and citations. None if no translator is available."""
    lines = text.split("\n")
    in_code = False
    jobs: list[tuple[int, int, str, str, list[str], str]] = []  # (line, sentence index, prefix, body, keep, cites)
    pieces: dict[int, list[str]] = {}
    for li, raw in enumerate(lines):
        if _FENCE.match(raw.strip()):
            in_code = not in_code
            continue
        if in_code or not raw.strip():
            continue
        prefix = _PREFIX.match(raw).group(1)  # type: ignore[union-attr]
        body = raw[len(prefix) :]
        sents = [s for s in _SENT.split(body) if s.strip()]
        pieces[li] = [prefix]
        for si, s in enumerate(sents):
            cites = " ".join(f"[{m.group(1)}]" for m in _CITE.finditer(s))
            s = _CITE.sub("", s)
            keep: list[str] = []

            def hold(m: re.Match[str], keep: list[str] = keep) -> str:
                keep.append(m.group(0))
                return f"X{len(keep)}"

            s = _PROTECT.sub(hold, s)
            jobs.append((li, si, prefix, s, keep, cites))
    if not jobs:
        return text
    out = await translate_sentences([j[3] for j in jobs], src, tgt)
    if out is None:
        return None
    built: dict[int, list[str]] = {}
    for (li, _si, _prefix, s_src, keep, cites), t in zip(jobs, out, strict=True):
        ok = all(f"X{i + 1}" in t for i in range(len(keep)))
        sent = t if ok else s_src  # a lost placeholder → keep this sentence in the source language
        for i, val in enumerate(keep):
            sent = sent.replace(f"X{i + 1}", val, 1)
        if cites:
            m = _END.search(sent)
            sent = f"{sent[: m.start()]} {cites}{m.group(1)}" if m else f"{sent} {cites}"
        built.setdefault(li, []).append(sent.strip())
    for li, sents in built.items():
        lines[li] = pieces[li][0] + " ".join(sents)
    return "\n".join(lines)
