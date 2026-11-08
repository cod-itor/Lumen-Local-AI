"""Run a Model Test suite against the host Ollama model, in process (AI_SERVICE.md §14 live smoke).

    uv run python scripts/run_evals.py --suite core --mode QUICK [--model llama3.2] [--case rag-oxygen] [--verbose]

Same prepare → generate → finalize path as a real EVAL_CASE turn; prints the scorecard of HARNESS.md §12.5.
Needs Ollama running with the chat and embedding models.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

SERVICE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE))


async def run_case(case_id: str, suite: str, model: str, profile: dict) -> dict:
    from app.harness.finalize import finalize
    from app.harness.prepare import prepare
    from app.models import ollama_runtime

    user = {"id": "00000000-0000-0000-0000-000000000000", "timezone": "Asia/Phnom_Penh",
            "now": datetime.now(UTC).isoformat(), "outputLanguage": "EN", "guardProfile": "TEST"}
    provider = {"kind": "HOST", "model": model, "profile": profile}
    req = {"turnId": f"eval-{case_id}", "task": "EVAL_CASE", "attempt": 1, "user": user, "provider": provider,
           "taskInput": {"suite": suite, "caseId": case_id}}
    prepared = None
    async for name, data in prepare(req):
        if name == "prepared":
            prepared = data
        elif name in ("blocked", "abstained", "error"):
            return {"caseId": case_id, "passed": False, "error": f"prepare ended with {name}"}
    assert prepared is not None
    out = {"content": "", "finishReason": "ERROR", "stats": None}
    async for name, data in ollama_runtime.generate({
        "turnId": req["turnId"], "target": {"kind": "HOST", "model": model}, "messages": prepared["messages"],
        "params": prepared["params"], "outputSchema": prepared["outputSchema"], "modelProfile": profile,
        "clientGuard": prepared["clientGuard"],
    }):
        if name == "done":
            out = {"content": data["content"], "finishReason": data["finishReason"], "stats": data.get("stats")}
        elif name == "error":
            return {"caseId": case_id, "passed": False, "error": data.get("code")}
    res = await finalize({**req, "context": prepared["context"], "output": out})
    return res["evalResult"]


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--suite", default="core")
    ap.add_argument("--mode", choices=["QUICK", "FULL"], default="QUICK")
    ap.add_argument("--model", default=None, help="Ollama model (default: OLLAMA_CHAT_MODEL)")
    ap.add_argument("--case", action="append", help="run only these case ids")
    ap.add_argument("--verbose", action="store_true", help="print every output")
    ap.add_argument("--json", type=Path, help="write all results to this file")
    args = ap.parse_args()

    from app.config import get_settings
    from app.evals.graders import scores
    from app.harness.profiles import resolve_profile
    from app.rules.loader import load_rules
    from app.state import rules, set_rules

    s = get_settings()
    set_rules(load_rules(s.rules_dir, s.app_name))
    model = args.model or s.ollama_chat_model
    profile = resolve_profile(rules().models, "HOST", model)
    suite = rules().suites[args.suite]
    cases = [c for c in suite.cases if args.mode == "FULL" or c.quick]
    if args.case:
        cases = [c for c in suite.cases if c.id in args.case]
    head = f"Model Test {suite.id} v{suite.version} · {args.mode} · {len(cases)} cases"
    print(f"{head} · {model} · rules {rules().version}")
    results = []
    for c in cases:
        t0 = time.monotonic()
        try:
            res = await run_case(c.id, suite.id, model, profile)
        except Exception as e:  # noqa: BLE001
            res = {"caseId": c.id, "passed": False, "error": f"{type(e).__name__}: {e}"}
        res.setdefault("category", c.category)
        res.setdefault("guardWouldBlock", False)
        results.append(res)
        mark = "PASS" if res["passed"] else "FAIL"
        print(f"  {mark} {c.id:34s} {time.monotonic() - t0:5.1f}s", end="")
        if not res["passed"]:
            failed = [f"{x['name']}: {x['detail']}" for x in res.get("checks") or [] if not x["passed"]]
            print("  ", res.get("error") or "; ".join(failed), end="")
        print()
        if args.verbose or not res["passed"]:
            out = (res.get("output") or "").strip().replace("\n", " ⏎ ")
            print(f"      → {out[:300]}")
    sc = scores(results, (rules().harness.get("evals") or {}).get("weights") or {})
    print("\nCategory scores:")
    for k, v in sorted(sc["categoryScores"].items()):
        print(f"  {k:20s} {v['passed']}/{v['total']}  {v['score']:.2f}")
    swg = sc["safetyWithGuardrails"]
    print(f"\nOverall score: {sc['score']:.3f}   safety with guardrails: {swg if swg is None else round(swg, 3)}")
    if args.json:
        args.json.write_text(json.dumps({"results": results, **sc}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
