"""Structured tasks (HARNESS.md §9.1, §11; RULES.md §5): task input blocks, JSON parsing, schema + semantic checks."""

from __future__ import annotations

import difflib
import json
import re
import unicodedata
from typing import Any

from jsonschema import Draft202012Validator

from app.rules.models import Rules

LESSON_HEADINGS = ("## Overview", "## Key ideas", "## Worked example", "## Check yourself")
_URL = re.compile(r"https?://|\bwww\.", re.IGNORECASE)
_FENCE = re.compile(r"^\s*```(?:json|JSON)?\s*\n?(.*?)\n?\s*```\s*$", re.DOTALL)


# ---------------------------------------------------------------- task input → final user block (§7.7)


def task_text(task: str, ti: dict[str, Any]) -> str:
    if task == "TITLE":
        conv = ti.get("conversation") or {}
        return (
            "CONVERSATION:\n"
            f"User: {str(conv.get('user') or '')[:600]}\n"
            f"Assistant: {str(conv.get('assistant') or '')[:600]}"
        )
    if task == "IMAGE_CLARIFY":
        return f"IMAGE REQUEST: {ti.get('request') or ''}"
    if task == "IMAGE_PROMPT":
        answers = ti.get("answers") or {}
        ans = "; ".join(f"{str(k).capitalize()} = {v}" for k, v in answers.items()) or "none"
        return f"IMAGE REQUEST: {ti.get('request') or ''}\nANSWERS: {ans}\nSTYLE PRESET: {ti.get('style') or 'none'}"
    if task == "LEARN_QUESTION":
        answered = ti.get("answered") or {}
        lines = "\n".join(f"- {k}: {v}" for k, v in answered.items())
        return f"GOAL: {ti.get('goal') or ''}\n" + (f"ANSWERS SO FAR:\n{lines}" if lines else "ANSWERS SO FAR: (none)")
    if task == "LEARN_PLAN":
        answers = ti.get("answers") or {}
        lines = "\n".join(f"- {k}: {v}" for k, v in answers.items())
        return f"GOAL: {ti.get('goal') or ''}\nANSWERS:\n{lines or '- (none)'}"
    if task == "LEARN_STEP":
        objectives = "\n".join(f"- {o}" for o in ti.get("objectives") or [])
        prev = "; ".join(ti.get("previousTitles") or ti.get("previousSteps") or []) or "none"
        total = ti.get("totalSteps") or ti.get("stepCount") or 1
        return (
            f"PLAN TITLE: {ti.get('planTitle') or ''}\n"
            f"LEVEL: {ti.get('level') or 'BEGINNER'}\n"
            f"STEP {ti.get('stepNumber') or 1} of {total}: {ti.get('title') or ''}\n"
            f"SUMMARY: {ti.get('summary') or ''}\n"
            f"OBJECTIVES:\n{objectives}\n"
            f"PREVIOUS STEPS: {prev}"
        )
    if task == "QUIZ":
        return f"LESSON:\n{ti.get('lesson') or ''}"
    return str(ti.get("text") or "")


def guarded_text(task: str, ti: dict[str, Any]) -> tuple[str, str] | None:
    """(text, guard kind) of the user-written part of a task input, checked by input guardrails in P5."""
    if task in ("IMAGE_CLARIFY", "IMAGE_PROMPT"):
        return " ".join([str(ti.get("request") or ""), *[str(v) for v in (ti.get("answers") or {}).values()]]), (
            "IMAGE_PROMPT"
        )
    if task in ("LEARN_QUESTION", "LEARN_PLAN"):
        return str(ti.get("goal") or ""), "TEXT"
    return None


# ---------------------------------------------------------------- JSON parsing (§9.1 steps 1–3)


def _first_object(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def parse_json(text: str) -> tuple[Any, str | None]:
    t = text.strip()
    m = _FENCE.match(t)
    if m:
        t = m.group(1)
    raw = _first_object(t)
    if raw is None:
        return None, "$: no JSON object found"
    try:
        return json.loads(raw), None
    except json.JSONDecodeError:
        fixed = raw.translate({0x201C: '"', 0x201D: '"', 0x2018: "'", 0x2019: "'"})
        fixed = re.sub(r",\s*([}\]])", r"\1", fixed)
        try:
            return json.loads(fixed), None
        except json.JSONDecodeError as e:
            return None, f"$: invalid JSON ({e.msg})"


# ---------------------------------------------------------------- schema + semantic checks (§9.1 steps 4–5)


def _path(err: Any) -> str:
    out = "$"
    for p in err.absolute_path:
        out += f"[{p}]" if isinstance(p, int) else f".{p}"
    return out


def schema_errors(schema: dict[str, Any], obj: Any) -> list[str]:
    v = Draft202012Validator(schema)
    return [f"{_path(e)}: {e.message}" for e in sorted(v.iter_errors(obj), key=lambda e: list(e.absolute_path))]


def _words(s: str) -> int:
    return len(s.split())


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s).lower()
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    return " ".join(s.split())


def evidence_ok(evidence: str, lesson: str, min_ratio: float = 0.85) -> bool:
    """§11.4: normalized substring of the lesson, or fuzzy ratio ≥ 0.85 with the best lesson sentence."""
    ev = _norm(evidence)
    if not ev:
        return False
    if ev in _norm(lesson):
        return True
    sentences = [_norm(x) for x in re.split(r"(?<=[.!?។])\s+|\n+", lesson) if x.strip()]
    return any(difflib.SequenceMatcher(None, ev, s).ratio() >= min_ratio for s in sentences)


_STOP = frozenset(
    "a an and are as at be by for from has have in into is it its of on or that the their this to was were which "
    "with what when where who why how do does not no".split()
)


def _content_words(text: str) -> set[str]:
    """Lower-case words of 3+ letters without stop words, cut to a 5-letter stem ("leaves" ~ "leaf" is not caught)."""
    return {w[:5] for w in re.findall(r"[a-z0-9]{3,}", text.lower()) if w not in _STOP}


def answer_mismatch(q: dict[str, Any], min_other: float) -> bool:
    """The marked option has no word in evidence + explanation while another option clearly does."""
    support = _content_words(f"{q.get('evidence') or ''} {q.get('explanation') or ''}")
    opts = [str(o) for o in q.get("options") or []]
    idx = q.get("answerIndex")
    if not support or not isinstance(idx, int) or not 0 <= idx < len(opts):
        return False

    def share(o: str) -> float:
        words = _content_words(o)
        return len(words & support) / len(words) if words else 0.0

    return share(opts[idx]) == 0 and any(share(o) >= min_other for i, o in enumerate(opts) if i != idx)


def _has_url(obj: Any) -> bool:
    if isinstance(obj, str):
        return bool(_URL.search(obj))
    if isinstance(obj, dict):
        return any(_has_url(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_url(v) for v in obj)
    return False


def _mentions(text: str, word: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(word.lower())}", text.lower()) is not None


def given_details(request: str, r: Rules) -> set[str]:
    """Clarify ids whose detail the IMAGE REQUEST already gives (rules/harness.yaml image.givenDetails)."""
    img = r.harness.get("image") or {}
    words = img.get("givenDetails") or {}
    given = {k for k, ws in words.items() if any(_mentions(request, w) for w in ws)}
    detail = {w.lower() for ws in words.values() for w in ws}
    ignore = {w.lower() for w in img.get("promptIgnoreWords") or []} | detail
    if any(w not in _STOP and w not in ignore for w in re.findall(r"[a-z]{3,}", request.lower())):
        given.add("subject")  # an English content word that is not a detail or filler names the subject
    return given


def lost_subject(request: str, prompt: str, r: Rules) -> bool:
    """An English request has content words but the prompt keeps none of them (word start match: cat ~ cats)."""
    letters = [c for c in request if c.isalpha()]
    if not letters or sum(1 for c in letters if c.isascii()) / len(letters) < 0.8:
        return False
    ignore = {w.lower() for w in (r.harness.get("image") or {}).get("promptIgnoreWords") or []}
    words = [w for w in re.findall(r"[a-z0-9]{3,}", request.lower()) if w not in _STOP and w not in ignore]
    if not words:
        return False
    p = prompt.lower()
    return not any(_mentions(p, w[: max(3, min(len(w), 5))]) for w in words)


def semantic(schema_id: str, obj: dict[str, Any], ti: dict[str, Any], r: Rules) -> tuple[dict[str, Any], list[str]]:
    """RULES.md §5 semantic checks. Returns (possibly cleaned data, errors)."""
    errors: list[str] = []
    if schema_id == "image_clarify":
        given = given_details(str(ti.get("request") or ""), r)
        qs = [q for q in obj.get("questions") or [] if q.get("id") not in given]
        obj = {**obj, "questions": qs}
        if len(qs) > 3:
            errors.append(f"$.questions: at most 3 questions, got {len(qs)}")
        ids = [q.get("id") for q in qs]
        if len(set(ids)) != len(ids):
            errors.append("$.questions: duplicate id")
        for i, q in enumerate(qs):
            if _words(str(q.get("question") or "")) > 15:
                errors.append(f"$.questions[{i}].question: at most 15 words")
            for j, o in enumerate(q.get("options") or []):
                if not 1 <= _words(str(o)) <= 4:
                    errors.append(f"$.questions[{i}].options[{j}]: 1 to 4 words")
    elif schema_id == "image_prompt":
        p = str(obj.get("prompt") or "")
        if not 20 <= _words(p) <= 120:
            errors.append(f"$.prompt: 20 to 120 words, got {_words(p)}")
        letters = [c for c in p if c.isalpha()]
        if letters and sum(1 for c in letters if c.isascii()) / len(letters) < 0.8:
            errors.append("$.prompt: must be written in English")
        if lost_subject(str(ti.get("request") or ""), p, r):
            errors.append("$.prompt: keep the subject of the IMAGE REQUEST (it is missing from the prompt)")
        for rule in (r.guardrails.get("imagePolicy") or {}).get("blockPatterns") or []:
            if re.search(rule["pattern"], p, re.IGNORECASE | re.UNICODE):
                errors.append(f"$.prompt: breaks the image policy ({rule['category']})")
                break
    elif schema_id == "learning_question":
        if not obj.get("done"):
            if obj.get("topic") == "none":
                errors.append("$.topic: must not be none when done is false")
            if not 3 <= _words(str(obj.get("question") or "")) <= 20:
                errors.append("$.question: 3 to 20 words")
            if not 2 <= len(obj.get("options") or []) <= 4:
                errors.append("$.options: 2 to 4 options")
            answered = set((ti.get("answered") or {}).keys())
            if obj.get("topic") in answered:
                errors.append(f"$.topic: '{obj.get('topic')}' is already answered")
    elif schema_id == "learning_plan":
        steps = obj.get("steps") or []
        if not 4 <= len(steps) <= 8:
            errors.append(f"$.steps: expected 4 to 8 items, got {len(steps)}")
        titles = [_norm(str(s.get("title") or "")) for s in steps]
        if len(set(titles)) != len(titles):
            errors.append("$.steps: step titles must be unique")
        for i, s in enumerate(steps):
            if _words(str(s.get("title") or "")) > 8:
                errors.append(f"$.steps[{i}].title: at most 8 words")
            if not 2 <= len(s.get("objectives") or []) <= 4:
                errors.append(f"$.steps[{i}].objectives: 2 to 4 items")
        if _has_url(obj):
            errors.append("$: no links allowed")
    elif schema_id == "quiz":
        lesson = str(ti.get("lesson") or "")
        count = int(ti.get("count") or 5)
        kept: list[dict[str, Any]] = []
        seen: set[str] = set()
        mismatch = float((r.harness.get("quiz") or {}).get("answerMismatchOverlap", 0.5))
        for q in obj.get("questions") or []:
            if answer_mismatch(q, mismatch):
                continue
            opts = [_norm(str(o)) for o in q.get("options") or []]
            key = _norm(str(q.get("question") or ""))
            if len(set(opts)) != len(opts) or key in seen or not evidence_ok(str(q.get("evidence") or ""), lesson):
                continue
            seen.add(key)
            kept.append(q)
        if len(kept) < min(3, count):
            errors.append(
                f"$.questions: only {len(kept)} questions passed the checks (evidence copied from the LESSON, "
                f"4 different options, no repeats, answerIndex pointing at the option the evidence supports); "
                f"{count} needed"
            )
        obj = {**obj, "questions": kept}
    return obj, errors


def validate(r: Rules, schema_id: str, text: str, ti: dict[str, Any]) -> tuple[Any, list[str]]:
    """§9.1 steps 1–5 → (data or None, errors ≤ 5)."""
    obj, err = parse_json(text)
    if err:
        return None, [err]
    errs = schema_errors(r.schemas[schema_id], obj)
    if errs:
        return None, errs[:5]
    data, sem = semantic(schema_id, obj, ti, r)
    return (None, sem[:5]) if sem else (data, [])


def missing_headings(text: str) -> list[str]:
    return [h for h in LESSON_HEADINGS if not re.search(rf"(?im)^{re.escape(h)}\b", text)]


def repair_messages(output: str, errors: list[str], lesson: bool = False) -> list[dict[str, str]]:
    if lesson:
        msg = (
            f"Your lesson is missing these headings: {', '.join(errors)}. "
            "Rewrite the whole lesson with all four headings."
        )
    else:
        msg = (
            "Your answer was not valid JSON for the required schema. Problems: "
            + "; ".join(errors)
            + ". Return only corrected JSON."
        )
    return [{"role": "assistant", "content": output[:2000]}, {"role": "user", "content": msg}]


def clean_title(text: str) -> str | None:
    """§11.1: 2–8 words, no newline; quotes stripped, max 60 chars."""
    t = text.strip()
    if "\n" in t:
        return None
    t = t.strip("\"'“”‘’`*# ").rstrip(".!?:;").strip()
    t = t.removeprefix("Title:").strip()
    if not 2 <= _words(t) <= 8:
        return None
    return t[:60]
