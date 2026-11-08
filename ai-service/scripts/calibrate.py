"""Threshold calibration (HARNESS.md §13.2). Prints recommended values; it never edits rules/ itself
(a rules change must be followed by a Model Test run, RULES.md §7).

    uv run python scripts/calibrate.py --retrieval            # minTopSimilarity from the core RAG cases (fixtures)
    uv run python scripts/calibrate.py --collect-support      # write calibration/support_candidates.csv (label it)
    uv run python scripts/calibrate.py --support              # lexicalSupport / semanticSupport from support_labels.csv
    uv run python scripts/calibrate.py --tokens               # tokenFactor per model family from turn_metrics

Needs Ollama (embedding model; --collect-support also the chat model) and, for --tokens/--collect-support, Postgres.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import math
import re
import statistics
import sys
from pathlib import Path
from typing import Any

SERVICE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE))
sys.path.insert(0, str(SERVICE / "scripts"))
CAL = SERVICE / "calibration"


def _pct(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    if not xs:
        return float("nan")
    k = (len(xs) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def _rag_cases(r: Any) -> list[Any]:
    return [
        c
        for c in r.suites["core"].cases
        if c.raw.get("pipeline") == "RAG"
        and c.raw.get("documents")
        and c.category in ("RAG_FAITHFULNESS", "RAG_ABSTAIN")
    ]


async def retrieval() -> None:
    from app.evals import fixtures
    from app.state import rules

    r = rules()
    ans: list[float] = []
    una: list[float] = []
    for c in _rag_cases(r):
        hits = await fixtures.top_chunks(list(c.raw["documents"]), [str(c.raw.get("input") or "")], 1)
        sim = hits[0].sim if hits else 0.0
        (ans if c.category == "RAG_FAITHFULNESS" else una).append(sim)
        print(f"  {c.category:17s} {c.id:30s} topSim {sim:.3f}")
    p10, p90 = _pct(ans, 0.10), _pct(una, 0.90)
    cur = float(r.harness["retrieval"]["minTopSimilarity"])
    if p10 > p90:
        rec = round((p10 + p90) / 2, 2)
        note = "midpoint (ranges separate)"
    else:
        rec = round(min(p10, p90), 2)
        note = "ranges overlap → lower value (prefer letting the model abstain)"
    print(f"\nanswerable p10 = {p10:.3f} (n={len(ans)}), unanswerable p90 = {p90:.3f} (n={len(una)})")
    print(f"minTopSimilarity: current {cur} → recommended {rec}  [{note}]")


async def _score(sentence: str, sources: list[tuple[str, list[float] | None]], cfg: dict[str, Any]) -> tuple:
    from app.harness.grounding import _lexical, _prepare_source
    from app.harness.sentences import content_words, plain
    from app.models.embeddings import dot, embed, query_text

    p = plain(sentence)
    (v,) = await embed([query_text(p)])
    srcs = [_prepare_source(i + 1, t, e, cfg) for i, (t, e) in enumerate(sources)]
    sw = content_words(p)
    lex = max((_lexical(sw, s) for s in srcs), default=0.0)
    sem = max((dot(v, s.embedding) for s in srcs if s.embedding), default=0.0)
    return round(lex, 3), round(sem, 3)


def _factual_sentences(text: str, cfg: dict[str, Any], abstain: str | None) -> list[str]:
    from app.harness.grounding import _is_factual
    from app.harness.sentences import split_spans

    meta = [re.compile(p) for p in cfg.get("metaPatterns") or []]
    return [text[a:b].strip() for a, b in split_spans(text) if _is_factual(text[a:b], cfg, meta, abstain)]


async def collect_support(model: str) -> None:
    """Candidates = factual answer sentences scored against their own sources and against unrelated sources."""
    from run_evals import run_case

    from app.evals import fixtures
    from app.harness.profiles import resolve_profile
    from app.models.embeddings import doc_text, embed
    from app.state import rules

    r = rules()
    cfg = r.harness["grounding"]
    profile = resolve_profile(r.models, "HOST", model)
    files = list(r.fixtures)
    rows: list[dict[str, Any]] = []

    async def add(origin: str, sentence: str, own: list, other: list) -> None:
        for kind, srcs in (("own", own), ("other", other)):
            lex, sem = await _score(sentence, srcs, cfg)
            rows.append({"origin": origin, "sources": kind, "sentence": sentence, "lex": lex, "sem": sem, "label": ""})

    for c in [c for c in _rag_cases(r) if c.category == "RAG_FAITHFULNESS"]:
        res = await run_case(c.id, "core", model, profile)
        docs = list(c.raw["documents"])
        q = [str(c.raw.get("input") or "")]
        own_hits = await fixtures.top_chunks(docs, q, 3)
        other_hits = await fixtures.top_chunks([f for f in files if f not in docs], q, 3)
        vec = await fixtures.embeddings([h.id for h in own_hits + other_hits])
        own = [(h.text, vec.get(h.id)) for h in own_hits]
        other = [(h.text, vec.get(h.id)) for h in other_hits]
        for s in _factual_sentences(res.get("output") or "", cfg, None):
            await add(f"eval:{c.id}", s, own, other)
        print(f"  eval {c.id}: {len(rows)} rows so far")

    try:  # logged RAG answers (their cited chunks are still in the database)
        from app import db
        from app.config import get_settings

        await db.open_pool(get_settings().database_url)
        async with db.pool().connection() as conn:
            cur = await conn.execute(
                "SELECT m.content, m.meta->'sources' FROM messages m WHERE m.role = 'ASSISTANT' "
                "AND m.meta->>'pipeline' = 'RAG' AND jsonb_array_length(coalesce(m.meta->'sources','[]')) > 0"
            )
            logged = await cur.fetchall()
            pool_cur = await conn.execute("SELECT text FROM chunks WHERE source = 'WEB' ORDER BY random() LIMIT 3")
            unrelated = [x[0] for x in await pool_cur.fetchall()]
        unrel = list(zip(unrelated, await embed([doc_text("web", t) for t in unrelated]), strict=True))
        for content, sources in logged:
            ids = [str(s.get("chunkId")) for s in sources or [] if s.get("chunkId")]
            async with db.pool().connection() as conn:
                cur = await conn.execute("SELECT text, embedding FROM chunks WHERE id = ANY(%s::uuid[])", (ids,))
                own = [(t, e.to_list()) for t, e in await cur.fetchall()]
            if not own:
                continue
            for s in _factual_sentences(content, cfg, None):
                await add("logged", s, own, unrel)
    except Exception as e:  # noqa: BLE001 — the database is optional for this step
        print(f"  (skipped logged turns: {e})")

    extra = CAL / "support_extra.csv"  # hand-written on-topic sentences with labels (paraphrases vs. made-up claims)
    if extra.is_file():
        for x in csv.DictReader(extra.open()):
            hits = await fixtures.top_chunks([x["document"]], [x["sentence"]], 3)
            vec = await fixtures.embeddings([h.id for h in hits])
            lex, sem = await _score(x["sentence"], [(h.text, vec.get(h.id)) for h in hits], cfg)
            rows.append(
                {
                    "origin": "hand",
                    "sources": "own",
                    "sentence": x["sentence"],
                    "lex": lex,
                    "sem": sem,
                    "label": x["label"],
                }
            )

    CAL.mkdir(exist_ok=True)
    out = CAL / "support_candidates.csv"
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["origin", "sources", "sentence", "lex", "sem", "label"])
        w.writeheader()
        w.writerows(rows)
    print(
        f"\n{len(rows)} candidates → {out}\nLabel each row S (supported) or U (unsupported) by hand, save as "
        f"{CAL / 'support_labels.csv'}, then run --support."
    )


def support() -> None:
    from app.state import rules

    path = CAL / "support_labels.csv"
    rows = [x for x in csv.DictReader(path.open()) if x["label"].strip().upper() in ("S", "U")]
    if len(rows) < 60:
        sys.exit(f"{path}: {len(rows)} labelled rows; at least 60 are needed (HARNESS.md §13.2)")
    data = [(float(x["lex"]), float(x["sem"]), x["label"].strip().upper() == "U") for x in rows]
    n_u = sum(1 for d in data if d[2])
    best: tuple | None = None
    for li in range(30, 96, 5):
        for si in range(50, 90):
            lt, st = li / 100, si / 100
            pred_u = [d for d in data if d[0] < lt and d[1] < st]
            tp = sum(1 for d in pred_u if d[2])
            prec = tp / len(pred_u) if pred_u else 0.0
            rec = tp / n_u if n_u else 0.0
            if prec >= 0.9 and rec >= 0.7:
                key = (rec, prec, -abs(lt - 0.55) - abs(st - 0.62))
                if best is None or key > best[0]:
                    best = (key, lt, st, prec, rec)
    g = rules().harness["grounding"]
    print(f"{len(data)} labelled rows ({n_u} unsupported)")
    print(f"current: lexicalSupport {g['lexicalSupport']}, semanticSupport {g['semanticSupport']}")
    for lt, st, label in ((float(g["lexicalSupport"]), float(g["semanticSupport"]), "current"),):
        pred_u = [d for d in data if d[0] < lt and d[1] < st]
        tp = sum(1 for d in pred_u if d[2])
        print(f"  {label}: precision(U) {tp / max(1, len(pred_u)):.2f}  recall(U) {tp / max(1, n_u):.2f}")
    if best is None:
        print("no pair reaches precision ≥ 0.9 with recall ≥ 0.7 — keep the current values and label more rows")
    else:
        _, lt, st, prec, rec = best
        print(f"recommended: lexicalSupport {lt}, semanticSupport {st}  (precision {prec:.2f}, recall {rec:.2f})")


async def tokens() -> None:
    from app import db
    from app.config import get_settings
    from app.harness.profiles import resolve_profile
    from app.state import rules

    await db.open_pool(get_settings().database_url)
    async with db.pool().connection() as conn:
        cur = await conn.execute(
            "SELECT provider_kind, model, actual_prompt_tokens::float / estimated_prompt_tokens FROM turn_metrics "
            "WHERE actual_prompt_tokens IS NOT NULL AND estimated_prompt_tokens > 0"
        )
        rows = await cur.fetchall()
    by: dict[str, list[float]] = {}
    for kind, model, ratio in rows:
        fam = resolve_profile(rules().models, kind or "HOST", model or "")["family"]
        by.setdefault(fam, []).append(ratio)
    for fam, xs in sorted(by.items()):
        med = statistics.median(xs)
        rec = math.ceil(med / 0.05 - 1e-9) * 0.05
        enough = "" if len(xs) >= 50 else "  (fewer than 50 turns: keep 1.0)"
        print(f"  {fam:22s} n={len(xs):4d} median {med:.3f} → tokenFactor {rec:.2f}{enough}")


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--retrieval", action="store_true")
    ap.add_argument("--collect-support", action="store_true")
    ap.add_argument("--support", action="store_true")
    ap.add_argument("--tokens", action="store_true")
    ap.add_argument("--model", default=None, help="Ollama chat model for --collect-support")
    args = ap.parse_args()

    from app.config import get_settings
    from app.rules.loader import load_rules
    from app.state import set_rules

    s = get_settings()
    set_rules(load_rules(s.rules_dir, s.app_name))
    if args.retrieval:
        await retrieval()
    if args.collect_support:
        await collect_support(args.model or s.ollama_chat_model)
    if args.support:
        support()
    if args.tokens:
        await tokens()
    if not any(vars(args)[k] for k in ("retrieval", "collect_support", "support", "tokens")):
        ap.print_help()
    from app import db

    if db._pool is not None:
        await db.close_pool()


if __name__ == "__main__":
    asyncio.run(main())
