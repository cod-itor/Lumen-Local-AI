"""Grounding verifier for RAG/WEB answers (HARNESS.md §10.2, AI_SERVICE.md §8.2).

Steps: validate/remove citations → split sentences → factual sentences → lexical + semantic support per source →
number and quote checks → citation repairs (auto-fix, auto-cite) → level. Offsets are computed last, on the final text,
in UTF-16 code units.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.harness.normalize import normalize
from app.harness.sentences import (
    BULLET,
    CITATION,
    KHMER_RUN,
    content_words,
    numbers,
    plain,
    split_spans,
    utf16,
    words,
)
from app.models.embeddings import dot, embed, query_text

_ADJ_CITES = re.compile(r"\](\s*)\[")
_QUOTE = re.compile(r"\"([^\"]+)\"|“([^”]+)”|«([^»]+)»")
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_END_PUNCT = re.compile(r"([.!?។៕:;]+)\s*$")


@dataclass
class Source:
    n: int
    text: str
    embedding: list[float] | None
    windows: list[set[str]] = field(default_factory=list)
    numbers: set[str] = field(default_factory=set)
    norm: str = ""


def _prepare_source(n: int, text: str, emb: list[float] | None, cfg: dict[str, Any]) -> Source:
    spans = split_spans(text)
    sents = [text[a:b] for a, b in spans] or [text]
    w = int(cfg.get("sourceWindowSentences", 3))
    windows = [content_words(" ".join(sents[i : i + w])) for i in range(max(1, len(sents) - w + 1))]
    nums = numbers(text)
    for word, value in (cfg.get("numberWords") or {}).items():
        if re.search(rf"\b{word}\b", text, re.IGNORECASE):
            nums.add(str(value))
    return Source(n=n, text=text, embedding=emb, windows=windows, numbers=nums, norm=_norm_quote(text))


def _norm_quote(s: str) -> str:
    return " ".join(_PUNCT.sub(" ", s.lower()).split())


def _cites(sentence: str, count: int) -> list[int]:
    out: list[int] = []
    for m in CITATION.finditer(sentence):
        for x in m.group(1).split(","):
            n = int(x.strip())
            if 1 <= n <= count and n not in out:
                out.append(n)
    return out


def remove_invalid(text: str, count: int) -> tuple[str, int]:
    """Step 1–2: `[1][2]` → `[1, 2]`; numbers outside 1..count are removed."""
    text = _ADJ_CITES.sub(", ", text) if "][" in text.replace(" ", "") else text
    removed = 0

    def fix(m: re.Match[str]) -> str:
        nonlocal removed
        keep = []
        for x in m.group(1).split(","):
            n = int(x.strip())
            if 1 <= n <= count:
                if n not in keep:
                    keep.append(n)
            else:
                removed += 1
        return f"[{', '.join(map(str, keep))}]" if keep else ""

    text = CITATION.sub(fix, text)
    return re.sub(r"[ \t]+([.,!?;:])", r"\1", text), removed


def _is_factual(s: str, cfg: dict[str, Any], meta: list[re.Pattern[str]], abstain: str | None) -> bool:
    raw = s.strip()
    if raw.startswith("#") or raw.endswith("?"):
        return False
    p = plain(raw)
    if abstain and _norm_quote(abstain) in _norm_quote(p):
        return False
    low = p.lower().strip()
    if any(m.search(low) for m in meta):
        return False
    khmer_chars = sum(len(r) for r in KHMER_RUN.findall(p))
    en_words = [w for w in words(p) if not KHMER_RUN.fullmatch(w)]
    return len(en_words) >= int(cfg["minFactualWords"]) or khmer_chars >= int(cfg["minFactualKhmerChars"])


def _lexical(sentence_words: set[str], src: Source) -> float:
    if not sentence_words:
        return 0.0
    return max((len(sentence_words & w) / len(sentence_words) for w in src.windows), default=0.0)


def _with_citation(sentence: str, ns: list[int]) -> str:
    """Replace all citations in a sentence by `[n…]`, placed before the final punctuation."""
    body = CITATION.sub("", sentence).rstrip()
    body = re.sub(r"[ \t]+([.,!?;:])", r"\1", body)
    tag = f" [{', '.join(map(str, ns))}]"
    m = _END_PUNCT.search(body)
    return body[: m.start()] + tag + m.group(1) if m else body + tag


async def verify(
    text: str,
    sources: list[dict[str, Any]],
    embeddings: dict[str, list[float]],
    cfg: dict[str, Any],
    abstain_text: str | None,
) -> tuple[str, dict[str, Any]]:
    count = len(sources)
    text, removed = remove_invalid(text, count)
    srcs = [
        _prepare_source(
            int(s["n"]), s.get("text") or s.get("snippet") or "", embeddings.get(str(s.get("chunkId"))), cfg
        )
        for s in sources
    ]
    meta = [re.compile(p) for p in cfg.get("metaPatterns") or []]

    spans = split_spans(text)
    sentences = [text[a:b] for a, b in spans]
    factual = [i for i, s in enumerate(sentences) if _is_factual(s, cfg, meta, abstain_text)]

    sent_vecs: dict[int, list[float]] = {}
    if factual and any(s.embedding for s in srcs):
        vecs = await embed([query_text(plain(sentences[i])) for i in factual])
        sent_vecs = dict(zip(factual, vecs, strict=True))

    lex_t, sem_t = float(cfg["lexicalSupport"]), float(cfg["semanticSupport"])
    q_min = int(cfg["quoteMinWords"])
    reports: dict[int, dict[str, Any]] = {}
    new_sentences = list(sentences)
    issues_hard = False

    for i in factual:
        s = sentences[i]
        p = plain(s)
        cited = _cites(s, count)
        sw = content_words(p)
        support: dict[int, float] = {}
        for src in srcs:
            lex = _lexical(sw, src)
            sem = dot(sent_vecs[i], src.embedding) if i in sent_vecs and src.embedding else 0.0
            if lex >= lex_t or sem >= sem_t:
                support[src.n] = max(lex / lex_t, sem / sem_t)
        issue: str | None = None
        supported = False
        final_cites = cited
        if cited:
            good = [n for n in cited if n in support]
            if good:
                supported = True
            elif support and cfg.get("autoFixCitations", True):
                best = max(support, key=lambda n: support[n])
                final_cites, supported, issue = [best], True, "INVALID_CITATION"
                new_sentences[i] = _with_citation(s, final_cites)
            else:
                issue = "LOW_SUPPORT"
        elif support and cfg.get("autoCite", True):
            ranked = sorted(support, key=lambda n: support[n], reverse=True)
            if len(ranked) == 1 or support[ranked[0]] > support[ranked[1]]:
                final_cites, supported, issue = [ranked[0]], True, "NO_CITATION"
                new_sentences[i] = _with_citation(s, final_cites)
            else:
                supported, issue = True, None
        else:
            issue = "NO_CITATION"

        backing = [src for src in srcs if src.n in (final_cites or list(support))]
        if supported:
            nums = numbers(p)
            if nums and not all(any(n in src.numbers for src in backing) for n in nums):
                supported, issue, issues_hard = False, "NUMBER_NOT_IN_SOURCE", True
        if supported:
            for m in _QUOTE.finditer(p):
                q = next(g for g in m.groups() if g)
                if len(q.split()) >= q_min and not any(_norm_quote(q) in src.norm for src in srcs):
                    supported, issue, issues_hard = False, "QUOTE_NOT_IN_SOURCE", True
                    break
        rep: dict[str, Any] = {"index": i, "citations": final_cites, "supported": supported}
        if issue and not (supported and issue in ("NO_CITATION", "INVALID_CITATION")):
            rep["issue"] = issue
        elif issue:
            rep["issue"] = issue  # repaired: noted, still supported
        reports[i] = rep

    # Rebuild the text with the repaired sentences (back to front keeps earlier offsets valid).
    out = text
    for i in sorted(reports, reverse=True):
        if new_sentences[i] != sentences[i]:
            a, b = spans[i]
            out = out[:a] + new_sentences[i] + out[b:]

    n_fact = len(factual)
    n_ok = sum(1 for r in reports.values() if r["supported"])
    ratio = (n_ok / n_fact) if n_fact else 1.0
    if not n_fact:
        level = "NOT_APPLICABLE"
    elif ratio >= float(cfg["groundedRatio"]) and not issues_hard:
        level = "GROUNDED"
    elif ratio >= float(cfg["partialRatio"]):
        level = "PARTIAL"
    else:
        level = "UNGROUNDED"
    report = {
        "level": level,
        "supportedRatio": round(ratio, 3),
        "sentences": [reports[i] for i in sorted(reports)],
        "removedUrls": 0,
        "removedCitations": removed,
        "hasSpecificFacts": False,
    }
    return out, report


def set_offsets(final_text: str, report: dict[str, Any]) -> None:
    """Sentence spans on the final model-language text, in UTF-16 code units (AI_SERVICE.md §8.2)."""
    spans = split_spans(final_text)
    for s in report.get("sentences") or []:
        i = s["index"]
        a, b = spans[i] if i < len(spans) else (len(final_text), len(final_text))
        s["start"], s["end"] = utf16(final_text, a), utf16(final_text, b)


def is_abstain(text: str, abstain_text: str | None, markers: list[str]) -> bool:
    """F10: the answer contains the mode's abstain sentence (or, when very short, an abstain marker)."""
    t = _norm_quote(normalize(text))
    if abstain_text and _norm_quote(abstain_text) in t:
        return True
    plain_text = BULLET.sub("", text)
    return len(plain_text.split()) <= 25 and any(_norm_quote(m) in t for m in markers)
